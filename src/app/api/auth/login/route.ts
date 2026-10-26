import { NextResponse } from 'next/server'
import { friendlyAuthError, normalizeKenyanPhone, phoneAuthEmail, validatePin } from '@/lib/phone'
import {
  clientIpFromRequest,
  clearRateLimit,
  hitRateLimit,
  inspectRateLimit,
  LOGIN_RATE_LIMIT,
  loginIpRateLimitKey,
  loginRateLimitKey,
  rateLimitMessage,
  retryAfterSeconds,
} from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const phone = normalizeKenyanPhone(String(body.phone || ''))
  const pin = String(body.pin || '')
  const pinError = validatePin(pin)

  if (!phone) {
    return NextResponse.json({ error: 'Enter a valid Kenyan phone number, for example 0712345678' }, { status: 400 })
  }
  if (pinError) {
    return NextResponse.json({ error: pinError }, { status: 400 })
  }

  const phoneKey = loginRateLimitKey(phone)
  const ipKey = loginIpRateLimitKey(clientIpFromRequest(request))
  const phoneLimit = inspectRateLimit(phoneKey, LOGIN_RATE_LIMIT)
  const ipLimit = inspectRateLimit(ipKey, LOGIN_RATE_LIMIT)
  const blocked = !phoneLimit.allowed ? phoneLimit : !ipLimit.allowed ? ipLimit : null
  if (blocked) {
    return NextResponse.json(
      { error: rateLimitMessage(blocked.retryAfterMs) },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(blocked.retryAfterMs)) } },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneAuthEmail(phone),
    password: pin,
  })

  if (error || !data.user) {
    hitRateLimit(phoneKey, LOGIN_RATE_LIMIT)
    const afterIp = hitRateLimit(ipKey, LOGIN_RATE_LIMIT)
    if (!afterIp.allowed) {
      return NextResponse.json(
        { error: rateLimitMessage(afterIp.retryAfterMs) },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(afterIp.retryAfterMs)) } },
      )
    }
    return NextResponse.json(
      { error: friendlyAuthError(error?.message || 'Phone number or PIN is incorrect') },
      { status: 401 },
    )
  }

  clearRateLimit(phoneKey)
  clearRateLimit(ipKey)

  const { data: adminRows } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .limit(1)

  if (adminRows && adminRows.length > 0) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'System administrators sign in with email.' }, { status: 403 })
  }

  const { data: memberships } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .limit(1)

  if (!memberships || memberships.length === 0) {
    if (data.user.user_metadata?.account_type === 'driver') {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Your fleet owner still needs to add this phone number to the fleet.' },
        { status: 403 },
      )
    }
    return NextResponse.json({ redirect: '/onboarding', mustChangePin: data.user.user_metadata?.must_change_pin === true })
  }

  return NextResponse.json({
    redirect: '/dashboard',
    mustChangePin: data.user.user_metadata?.must_change_pin === true,
  })
}
