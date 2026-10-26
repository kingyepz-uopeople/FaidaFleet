import { NextResponse } from 'next/server'
import { canSystemAdminResetPin, pinResetDeniedMessage, resolvePinInput } from '@/lib/pin'
import { recordPinReset, requireAdminClient, setAuthUserPin } from '@/lib/pin-reset'
import { normalizeKenyanPhone, phoneAuthEmail } from '@/lib/phone'
import {
  hitRateLimit,
  inspectRateLimit,
  pinResetRateLimitKey,
  PIN_RESET_RATE_LIMIT,
  rateLimitMessage,
  retryAfterSeconds,
} from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

type TargetKind = 'driver' | 'fleet_owner'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_system_admin')
  if (rpcError || !canSystemAdminResetPin(Boolean(isAdmin))) {
    return NextResponse.json({ error: 'Only a system administrator can reset this PIN' }, { status: 403 })
  }

  const limitKey = pinResetRateLimitKey(`admin:${user.id}`)
  const limit = inspectRateLimit(limitKey, PIN_RESET_RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterMs) },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(limit.retryAfterMs)) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const target = String(body.target || '') as TargetKind
  if (target !== 'driver' && target !== 'fleet_owner') {
    return NextResponse.json({ error: 'Choose a driver or fleet owner to reset' }, { status: 400 })
  }

  const resolved = resolvePinInput({
    pin: typeof body.pin === 'string' ? body.pin : null,
    generate: body.generate !== false,
  })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 })
  }

  const admin = requireAdminClient()
  if ('error' in admin) {
    return NextResponse.json({ error: admin.error }, { status: 500 })
  }

  hitRateLimit(limitKey, PIN_RESET_RATE_LIMIT)

  if (target === 'driver') {
    const driverId = String(body.driverId || '')
    if (!driverId) {
      return NextResponse.json({ error: 'Driver is required' }, { status: 400 })
    }

    const { data: driver, error: driverError } = await admin
      .from('drivers')
      .select('id, tenant_id, user_id, full_name, phone')
      .eq('id', driverId)
      .maybeSingle()

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    const phone = normalizeKenyanPhone(driver.phone)
    if (!phone) {
      return NextResponse.json({ error: 'This driver needs a valid Kenyan phone number before a PIN can be set' }, { status: 400 })
    }

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
      const { error: linkError } = await admin
        .from('drivers')
        .update({ user_id: applied.userId })
        .eq('id', driver.id)
        .select('id')

      if (linkError) {
        return NextResponse.json(
          { error: `PIN set, but the driver record could not be linked: ${linkError.message}` },
          { status: 500 },
        )
      }

      const { error: membershipError } = await admin
        .from('memberships')
        .upsert({
          user_id: applied.userId,
          tenant_id: driver.tenant_id,
          role: 'driver',
          is_active: true,
        }, { onConflict: 'user_id,tenant_id' })
        .select('id')

      if (membershipError) {
        return NextResponse.json(
          { error: `PIN set, but the fleet membership could not be created: ${membershipError.message}` },
          { status: 500 },
        )
      }
    }

    await recordPinReset(admin, {
      actorUserId: user.id,
      actorRole: 'system_admin',
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

  const tenantId = String(body.tenantId || '')
  if (!tenantId) {
    return NextResponse.json({ error: 'Fleet owner is required' }, { status: 400 })
  }

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, name, phone')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Fleet not found' }, { status: 404 })
  }

  const { data: ownerMembership } = await admin
    .from('memberships')
    .select('user_id, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle()

  const requestedPhone = normalizeKenyanPhone(String(body.phone || tenant.phone || ''))
  let userId = ownerMembership?.user_id || null
  let phone = requestedPhone
  let fullName = tenant.name

  if (userId) {
    const { data: existing } = await admin.auth.admin.getUserById(userId)
    const existingPhone = normalizeKenyanPhone(String(existing.user?.user_metadata?.phone || ''))
    phone = requestedPhone || existingPhone
    fullName = String(existing.user?.user_metadata?.full_name || tenant.name)
  }

  if (!phone) {
    return NextResponse.json({
      error: pinResetDeniedMessage('fleet_owner').includes('system')
        ? 'This fleet has no owner phone number. Enter a Kenyan phone number to create or reset the login.'
        : 'Enter a Kenyan phone number to create or reset the owner login.',
    }, { status: 400 })
  }

  const applied = await setAuthUserPin({
    admin,
    userId,
    email: phoneAuthEmail(phone),
    pin: resolved.pin,
    fullName,
    phone,
    accountType: 'fleet_owner',
  })
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: applied.status })
  }

  if (!ownerMembership) {
    const { error: membershipError } = await admin
      .from('memberships')
      .upsert({
        user_id: applied.userId,
        tenant_id: tenantId,
        role: 'owner',
        is_active: true,
      }, { onConflict: 'user_id,tenant_id' })
      .select('id')

    if (membershipError) {
      return NextResponse.json(
        { error: `PIN set, but the owner membership could not be created: ${membershipError.message}` },
        { status: 500 },
      )
    }
  }

  if (!tenant.phone) {
    const { error: tenantError } = await admin
      .from('tenants')
      .update({ phone })
      .eq('id', tenantId)
      .select('id')

    if (tenantError) {
      return NextResponse.json(
        { error: `PIN set, but the fleet phone number could not be saved: ${tenantError.message}` },
        { status: 500 },
      )
    }
  }

  await recordPinReset(admin, {
    actorUserId: user.id,
    actorRole: 'system_admin',
    targetKind: 'fleet_owner',
    targetUserId: applied.userId,
    tenantId,
  })

  return NextResponse.json({
    pin: resolved.pin,
    generated: resolved.generated,
    created: applied.created,
    phone,
    message: 'PIN set. Share it once, then it cannot be viewed again.',
  })
}
