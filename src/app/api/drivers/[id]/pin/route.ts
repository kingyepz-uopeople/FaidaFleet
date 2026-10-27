import { NextResponse } from 'next/server'
import { canFleetResetDriverPin, needsPinChange, pinResetDeniedMessage, resolvePinInput } from '@/lib/pin'
import { recordPinReset, requireAdminClient, setAuthUserPin } from '@/lib/pin-reset'
import { normalizeKenyanPhone, phoneAuthEmail } from '@/lib/phone'
import {
  inspectRateLimit,
  pinResetRateLimitKey,
  PIN_RESET_RATE_LIMIT,
  rateLimitMessage,
  retryAfterSeconds,
  hitRateLimit,
} from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (needsPinChange(user)) {
    return NextResponse.json({ error: 'Set your own PIN in Settings before managing drivers.' }, { status: 403 })
  }

  const limitKey = pinResetRateLimitKey(user.id)
  const limit = inspectRateLimit(limitKey, PIN_RESET_RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterMs) },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(limit.retryAfterMs)) } },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const resolved = resolvePinInput({
    pin: typeof body.pin === 'string' ? body.pin : null,
    generate: body.generate !== false,
  })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 400 })
  }

  const membership = (memberships || []).find((row) => row.role === 'owner' || row.role === 'admin')
  if (!membership) {
    return NextResponse.json({ error: pinResetDeniedMessage('driver') }, { status: 403 })
  }

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id, tenant_id, user_id, full_name, phone')
    .eq('id', driverId)
    .maybeSingle()

  if (driverError || !driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  if (!canFleetResetDriverPin({
    actorRole: membership.role,
    actorTenantId: membership.tenant_id,
    driverTenantId: driver.tenant_id,
  })) {
    return NextResponse.json({ error: pinResetDeniedMessage('driver') }, { status: 403 })
  }

  const phone = normalizeKenyanPhone(driver.phone)
  if (!phone) {
    return NextResponse.json({ error: 'This driver needs a valid Kenyan phone number before a PIN can be set' }, { status: 400 })
  }

  const admin = requireAdminClient()
  if ('error' in admin) {
    return NextResponse.json({ error: admin.error }, { status: 500 })
  }

  hitRateLimit(limitKey, PIN_RESET_RATE_LIMIT)

  const applied = await setAuthUserPin({
    admin,
    userId: driver.user_id,
    email: phoneAuthEmail(phone),
    pin: resolved.pin,
    fullName: driver.full_name,
    phone,
    accountType: 'driver',
  })

  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: applied.status })
  }

  if (!driver.user_id || driver.user_id !== applied.userId) {
    const { error: linkError } = await supabase.rpc('provision_driver_login', {
      p_driver_id: driver.id,
      p_user_id: applied.userId,
    })
    if (linkError) {
      const { error: fallbackError } = await admin
        .from('drivers')
        .update({ user_id: applied.userId })
        .eq('id', driver.id)
        .select('id')

      if (fallbackError) {
        return NextResponse.json(
          { error: `PIN set, but the driver record could not be linked: ${fallbackError.message}` },
          { status: 500 },
        )
      }

      // The RPC also creates the driver membership. When it is missing, the
      // fallback has to do both the link AND the membership, otherwise the
      // driver signs in to an empty app.
      const { error: membershipError } = await admin
        .from('memberships')
        .upsert(
          {
            user_id: applied.userId,
            tenant_id: driver.tenant_id,
            role: 'driver',
            is_active: true,
          },
          { onConflict: 'user_id,tenant_id' },
        )
        .select('id')

      if (membershipError) {
        return NextResponse.json(
          { error: `PIN set, but the fleet membership could not be created: ${membershipError.message}` },
          { status: 500 },
        )
      }
    }
  }

  await recordPinReset(admin, {
    actorUserId: user.id,
    actorRole: membership.role === 'admin' ? 'admin' : 'owner',
    targetKind: 'driver',
    targetUserId: applied.userId,
    targetDriverId: driver.id,
    tenantId: driver.tenant_id,
  })

  return NextResponse.json({
    pin: resolved.pin,
    generated: resolved.generated,
    created: applied.created,
    message: 'PIN set. Share it once, then it cannot be viewed again.',
  })
}
