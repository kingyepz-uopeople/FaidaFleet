import { createClient } from '@supabase/supabase-js'
import { friendlyAuthError } from './phone'

export type DriverAuthResult = { userId: string } | { error: string }

export function interpretDriverSignUp(input: {
  errorMessage?: string | null
  userId?: string | null
  identityCount?: number | null
  confirmed: boolean
}): DriverAuthResult {
  if (input.errorMessage) {
    const lower = input.errorMessage.toLowerCase()
    if (lower.includes('already')) {
      return { error: 'That phone number already has a login. The driver can sign in with their PIN.' }
    }
    return { error: friendlyAuthError(input.errorMessage) }
  }

  if (!input.userId || input.identityCount === 0) {
    return { error: 'That phone number already has a login. The driver can sign in with their PIN.' }
  }

  if (!input.confirmed) {
    return {
      error: 'The Supabase project still requires email confirmation. Turn off Confirm email under Authentication so this driver can sign in with a PIN.',
    }
  }

  return { userId: input.userId }
}

export async function createDriverAuthUser(input: {
  url: string
  anonKey: string
  serviceRoleKey?: string | null
  email: string
  pin: string
  fullName: string
  phone: string
}): Promise<DriverAuthResult> {
  const metadata = {
    full_name: input.fullName,
    phone: input.phone,
    account_type: 'driver',
  }

  if (input.serviceRoleKey) {
    const admin = createClient(input.url, input.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.pin,
      email_confirm: true,
      user_metadata: metadata,
    })
    return interpretDriverSignUp({
      errorMessage: error?.message,
      userId: data.user?.id,
      identityCount: data.user ? 1 : 0,
      confirmed: true,
    })
  }

  const anon = createClient(input.url, input.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.signUp({
    email: input.email,
    password: input.pin,
    options: { data: metadata },
  })
  const confirmed = Boolean(data.session || data.user?.email_confirmed_at || data.user?.confirmed_at)
  return interpretDriverSignUp({
    errorMessage: error?.message,
    userId: data.user?.id,
    identityCount: data.user?.identities?.length ?? (data.user ? null : 0),
    confirmed,
  })
}
