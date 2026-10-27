import { createClient as createStatelessClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { authPasswordFromPin, friendlyPinError, SAME_PIN_MESSAGE } from '@/lib/pin-auth'
import { MUST_CHANGE_PIN_KEY, needsPinChange } from '@/lib/pin'
import { friendlyAuthError, isPhoneAuthEmail, validatePin } from '@/lib/phone'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/env'
import {
  clearRateLimit,
  hitRateLimit,
  inspectRateLimit,
  LOGIN_RATE_LIMIT,
  rateLimitMessage,
  retryAfterSeconds,
} from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

/**
 * Browser code never calls supabase.auth.updateUser with a raw PIN. PINs are
 * transformed on the server with the ONE shared helper, must_change_pin is
 * cleared in the same update, and the result is verified before we report
 * success.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const currentPin = String(body.currentPin || '').trim()
  const newPin = String(body.newPin || '').trim()
  const confirmPin = typeof body.confirmPin === 'string' ? body.confirmPin.trim() : null

  const currentError = validatePin(currentPin)
  const newError = validatePin(newPin)
  if (currentError) return NextResponse.json({ error: `Current PIN: ${currentError}` }, { status: 400 })
  if (newError) return NextResponse.json({ error: `New PIN: ${newError}` }, { status: 400 })
  if (confirmPin !== null && confirmPin !== newPin) {
    return NextResponse.json({ error: 'PINs do not match' }, { status: 400 })
  }
  if (currentPin === newPin) {
    return NextResponse.json({ error: SAME_PIN_MESSAGE }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isPhoneAuthEmail(user.email)) {
    return NextResponse.json({ error: 'PIN changes are for phone accounts' }, { status: 403 })
  }

  const limitKey = `change-pin:${user.id}`
  const limit = inspectRateLimit(limitKey, LOGIN_RATE_LIMIT)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterMs) },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(limit.retryAfterMs)) } },
    )
  }

  const url = getSupabaseUrl()
  const key = getSupabaseKey()
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  try {
    // Verify the current PIN with a throwaway client so the signed-in session
    // and its cookies are not replaced by the check.
    const verifier = createStatelessClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: user.email as string,
      password: authPasswordFromPin(currentPin),
    })
    if (verifyError) {
      const after = hitRateLimit(limitKey, LOGIN_RATE_LIMIT)
      if (!after.allowed) {
        return NextResponse.json(
          { error: rateLimitMessage(after.retryAfterMs) },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(after.retryAfterMs)) } },
        )
      }
      const lower = verifyError.message.toLowerCase()
      const message = lower.includes('invalid') ? 'Current PIN is incorrect' : friendlyAuthError(verifyError.message)
      return NextResponse.json({ error: message }, { status: 401 })
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: authPasswordFromPin(newPin),
      data: { [MUST_CHANGE_PIN_KEY]: false },
    })
    if (updateError) {
      return NextResponse.json({ error: friendlyPinError(updateError.message) }, { status: 400 })
    }
    // The dialog only closes when the server confirms the flag is really gone.
    const { data: refreshed, error: refreshError } = await supabase.auth.getUser()
    if (refreshError || needsPinChange(refreshed.user)) {
      return NextResponse.json(
        { error: 'Your new PIN was saved, but the PIN prompt did not clear. Sign out and sign in again.' },
        { status: 500 },
      )
    }

    clearRateLimit(limitKey)
    return NextResponse.json({ ok: true, mustChangePin: false })
  } catch (err) {
    const message = err instanceof Error ? friendlyPinError(err.message) : 'Could not change PIN'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
