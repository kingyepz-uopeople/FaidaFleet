import { NextResponse } from 'next/server'
import { createDriverAuthUser } from '@/lib/create-driver-login'
import { normalizeKenyanPhone, phoneAuthEmail, validatePin } from '@/lib/phone'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const fullName = String(body.full_name || '').trim()
  const phone = normalizeKenyanPhone(String(body.phone || ''))
  const pin = String(body.pin || '')
  const pinError = validatePin(pin)

  if (!fullName) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ error: 'Enter a valid Kenyan phone number' }, { status: 400 })
  }
  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 })
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
    return NextResponse.json({ error: 'Only a fleet owner or admin can add a driver login' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const created = await createDriverAuthUser({
    url,
    anonKey,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    email: phoneAuthEmail(phone),
    pin,
    fullName,
    phone,
  })

  if ('error' in created) {
    return NextResponse.json({ error: created.error }, { status: 400 })
  }

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .insert({
      tenant_id: membership.tenant_id,
      user_id: created.userId,
      full_name: fullName,
      phone,
      license_number: body.license_number ? String(body.license_number) : null,
      license_expiry: body.license_expiry ? String(body.license_expiry) : null,
      id_number: body.id_number ? String(body.id_number) : null,
      is_active: true,
    })
    .select('id')
    .single()

  if (driverError || !driver) {
    return NextResponse.json({ error: driverError?.message || 'Could not save the driver' }, { status: 400 })
  }

  const { error: linkError } = await supabase.rpc('provision_driver_login', {
    p_driver_id: driver.id,
    p_user_id: created.userId,
  })

  if (linkError) {
    await supabase.from('drivers').delete().eq('id', driver.id)
    const missingFunction = linkError.code === '42883' || linkError.message.includes('provision_driver_login')
    return NextResponse.json({
      error: missingFunction
        ? 'Run supabase/migrations/006_phone_pin_auth.sql in the new Supabase project, then add the driver again.'
        : linkError.message,
    }, { status: 400 })
  }

  return NextResponse.json({ id: driver.id, phone })
}
