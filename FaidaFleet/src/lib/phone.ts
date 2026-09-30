export const PHONE_AUTH_DOMAIN = 'phone.faidafleet.local'
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6

export type AccountUser = {
  email?: string | null
  user_metadata?: {
    full_name?: string | null
    phone?: string | null
    account_type?: string | null
  } | null
}

export function normalizeKenyanPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s()-]/g, '')
  if (!compact) return null

  let national = ''
  if (compact.startsWith('+254')) national = compact.slice(4)
  else if (compact.startsWith('254')) national = compact.slice(3)
  else if (compact.startsWith('0')) national = compact.slice(1)
  else national = compact

  if (!/^[17]\d{8}$/.test(national)) return null
  return `+254${national}`
}

export function phoneAuthEmail(e164: string): string {
  return `${e164.replace(/\D/g, '')}@${PHONE_AUTH_DOMAIN}`
}

export function isPhoneAuthEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${PHONE_AUTH_DOMAIN}`))
}

export function displayPhoneFromAuthEmail(email: string | null | undefined): string | null {
  if (!isPhoneAuthEmail(email) || !email) return null
  const digits = email.split('@')[0]
  if (!/^254[17]\d{8}$/.test(digits)) return null
  return `+${digits}`
}

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'PIN must contain digits only'
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return `PIN must be ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits`
  }
  return null
}

export function isPhoneAccount(user: AccountUser | null | undefined): boolean {
  if (!user) return false
  return isPhoneAuthEmail(user.email) || user.user_metadata?.account_type === 'fleet_owner' || user.user_metadata?.account_type === 'driver'
}

export function accountPhone(user: AccountUser | null | undefined): string | null {
  if (!user) return null
  const stored = user.user_metadata?.phone
  if (stored) {
    const normalized = normalizeKenyanPhone(stored)
    if (normalized) return normalized
  }
  return displayPhoneFromAuthEmail(user.email)
}

export function accountLabel(user: AccountUser | null | undefined): string {
  const name = user?.user_metadata?.full_name?.trim()
  if (name) return name
  return accountPhone(user) || (isPhoneAuthEmail(user?.email) ? 'User' : user?.email?.split('@')[0] || 'User')
}

export function accountContact(user: AccountUser | null | undefined): string {
  return accountPhone(user) || (isPhoneAuthEmail(user?.email) ? '' : user?.email || '')
}

export function accountInitials(user: AccountUser | null | undefined): string {
  const name = user?.user_metadata?.full_name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  const phone = accountPhone(user)
  if (phone) return phone.replace(/\D/g, '').slice(-2)
  const email = user?.email
  if (email && !isPhoneAuthEmail(email)) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export function friendlyAuthError(message: string, kind: 'phone' | 'email' = 'phone'): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return kind === 'phone' ? 'Phone number or PIN is incorrect' : 'Email or password is incorrect'
  }
  if (lower.includes('email not confirmed')) {
    return 'Turn off Confirm email in the Supabase project under Authentication, then sign in again. Phone accounts cannot receive email.'
  }
  if (lower.includes('password') && (lower.includes('at least') || lower.includes('characters'))) {
    return 'Supabase rejected this PIN. Set the minimum password length to 4 under Authentication settings.'
  }
  return message
}
