import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, validatePin } from './phone'

export const DEFAULT_PIN_LENGTH = 6
export const MUST_CHANGE_PIN_KEY = 'must_change_pin'

export type FleetManageRole = 'owner' | 'admin'
export type PinActorRole = 'system_admin' | 'owner' | 'admin' | 'accountant' | 'driver' | 'none'
export type PinTargetKind = 'driver' | 'fleet_owner'

export type PinResolveResult =
  | { ok: true; pin: string; generated: boolean }
  | { ok: false; error: string }

const FLEET_PIN_MANAGERS: readonly string[] = ['owner', 'admin']

function randomDigit(): number {
  const bytes = new Uint8Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0] % 10
}

export function generatePin(length: number = DEFAULT_PIN_LENGTH): string {
  if (!Number.isInteger(length) || length < PIN_MIN_LENGTH || length > PIN_MAX_LENGTH) {
    throw new Error(`PIN length must be ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH}`)
  }
  let pin = ''
  for (let i = 0; i < length; i += 1) {
    pin += String(randomDigit())
  }
  return pin
}

export function resolvePinInput(input: {
  pin?: string | null
  generate?: boolean | null
  length?: number | null
}): PinResolveResult {
  const requested = typeof input.pin === 'string' ? input.pin.trim() : ''
  if (requested) {
    const error = validatePin(requested)
    if (error) return { ok: false, error }
    return { ok: true, pin: requested, generated: false }
  }
  if (input.generate === false) {
    return { ok: false, error: 'Enter a 4 to 6 digit PIN, or generate a random PIN' }
  }
  try {
    return { ok: true, pin: generatePin(input.length ?? DEFAULT_PIN_LENGTH), generated: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not generate a PIN' }
  }
}

export function isFleetPinManager(role: string | null | undefined): role is FleetManageRole {
  return Boolean(role && FLEET_PIN_MANAGERS.includes(role))
}

export function canFleetResetDriverPin(input: {
  actorRole: string | null | undefined
  actorTenantId: string | null | undefined
  driverTenantId: string | null | undefined
}): boolean {
  if (!isFleetPinManager(input.actorRole)) return false
  if (!input.actorTenantId || !input.driverTenantId) return false
  return input.actorTenantId === input.driverTenantId
}

export function canSystemAdminResetPin(isSystemAdmin: boolean): boolean {
  return isSystemAdmin === true
}

export function pinResetDeniedMessage(kind: PinTargetKind): string {
  if (kind === 'driver') {
    return 'Only an active fleet owner or admin of this driver\'s fleet can reset this PIN'
  }
  return 'Only a system administrator can set or reset a fleet owner PIN'
}

export function needsPinChange(user: {
  user_metadata?: Record<string, unknown> | null
  app_metadata?: Record<string, unknown> | null
} | null | undefined): boolean {
  return user?.app_metadata?.[MUST_CHANGE_PIN_KEY] === true
}

export function actorRoleLabel(input: {
  isSystemAdmin: boolean
  membershipRole?: string | null
}): PinActorRole {
  if (input.isSystemAdmin) return 'system_admin'
  const role = input.membershipRole
  if (role === 'owner' || role === 'admin' || role === 'accountant' || role === 'driver') {
    return role
  }
  return 'none'
}
