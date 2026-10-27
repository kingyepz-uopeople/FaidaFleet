import { PIN_MAX_LENGTH, friendlyAuthError, validatePin } from './phone'

/**
 * SERVER-ONLY bridge between the 4-6 digit PIN people type and the password
 * Supabase Auth stores.
 *
 * Supabase Auth has a hard minimum password length of 6 that cannot be lowered.
 * Accounts created with a 6-digit PIN already use that PIN verbatim as their
 * password, so 6-digit PINs pass through unchanged. Shorter PINs get a
 * deterministic, server-only suffix before they ever reach Supabase.
 *
 * PIN_PEPPER is optional: a fixed fallback keeps existing deployments working
 * when the variable is absent. It must stay stable once short PINs are in use,
 * because changing it changes every short PIN's password. Never expose its
 * value to the browser.
 */
export const PIN_PEPPER_FALLBACK = 'FaidaFleet-PIN-v1-7d3b!'
export const SAME_PIN_MESSAGE = 'Choose a PIN that is different from the one you use now.'

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('PIN passwords can only be built on the server')
  }
}

/** The ONE transform every set / reset / change / verify path must use. */
export function authPasswordFromPin(pin: string): string {
  assertServerOnly()
  const trimmed = typeof pin === 'string' ? pin.trim() : ''
  const error = validatePin(trimmed)
  if (error) throw new Error(error)

  // Never transform 6-digit PINs: those accounts already exist with the raw
  // PIN as their password and must keep working unchanged.
  if (trimmed.length >= PIN_MAX_LENGTH) return trimmed

  const pepper = process.env.PIN_PEPPER?.trim() || PIN_PEPPER_FALLBACK
  return `${trimmed}${pepper}`
}

/** Supabase's "same password" error is confusing when the password is a PIN. */
export function friendlyPinError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('different from the old password') ||
    lower.includes('same as the old password') ||
    lower.includes('same password')
  ) {
    return SAME_PIN_MESSAGE
  }
  return friendlyAuthError(message)
}
