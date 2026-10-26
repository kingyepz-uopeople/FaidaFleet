import { NextResponse } from 'next/server'
import { authPasswordFromPin, friendlyPinError } from '@/lib/pin-auth'
import {
  friendlyAuthError,
  normalizeKenyanPhone,
  phoneAuthEmail,
  validatePin,
} from '@/lib/phone'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

/**
 * Fleet-owner self sign-up. The password is built on the server so 4- and
 * 5-digit PINs work and PIN_PEPPER never reaches the browser.
 * System administrators keep their unchanged email sign-in elsewhere.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const fullName = String(body.fullName || '').trim()
  const phone = normalizeKenyanPhone(String(body.phone || ''))
  const pin = String(body.pin || '').trim()
  const pinError = validatePin(pin)

  if (!fullName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  if (!phone) {
    return NextResponse.json(
      { error: 'Enter a valid Kenyan phone number, for example 0712345678' },
      { status: 400 },
    )
  }
  if (pinError) return NextResponse.json({ error: pinError }, { status: 400 })

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: phoneAuthEmail(phone),
      password: authPasswordFromPin(pin),
      options: {
        data: {
          full_name: fullName,
          phone,
          account_type: 'fleet_owner',
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: friendlyAuthError(error.message) }, { status: 400 })
    }
    if (!data.session) {
      return NextResponse.json(
        {
          error:
            'Account was created, but this Supabase project still confirms email. Turn off Confirm email under Authentication, then sign in with this phone number and PIN.',
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ redirect: '/onboarding' })
  } catch (err) {
    const message = err instanceof Error ? friendlyPinError(err.message) : 'Could not create the account'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
