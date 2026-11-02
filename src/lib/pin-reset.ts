import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { authPasswordFromPin } from '@/lib/pin-auth'
import {
  actorRoleLabel,
  MUST_CHANGE_PIN_KEY,
  type PinActorRole,
  type PinTargetKind,
} from '@/lib/pin'
import { phoneAuthEmail } from '@/lib/phone'

export type PinResetLogInput = {
  actorUserId: string
  actorRole: Extract<PinActorRole, 'system_admin' | 'owner' | 'admin'>
  targetKind: PinTargetKind
  targetUserId?: string | null
  targetDriverId?: string | null
  tenantId?: string | null
}

export type ApplyPinResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string; status: number }

type AuthAdmin = NonNullable<ReturnType<typeof createAdminClient>>

export function requireAdminClient(): AuthAdmin | { error: string } {
  const admin = createAdminClient()
  if (!admin) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }
  }
  return admin
}

export async function findAuthUserByEmail(admin: AuthAdmin, email: string): Promise<User | null> {
  const normalized = email.toLowerCase()
  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized)
    if (match) return match
    if (data.users.length < perPage) return null
    page += 1
  }
  return null
}

export function permitsPinTarget(rows: { tenant_id: string; role: string }[], tenantId: string, driver: boolean): boolean {
  if (!driver) return rows.some(row => row.tenant_id === tenantId && row.role === 'owner')
  return rows.length > 0 && rows.every(row => row.tenant_id === tenantId && row.role === 'driver')
}

// Fail closed on query errors; include inactive memberships and admin rows.
export async function isSafePinTarget(admin: AuthAdmin, userId: string, tenantId: string, driver: boolean): Promise<boolean> {
  const [memberships, admins] = await Promise.all([
    admin.from('memberships').select('tenant_id, role').eq('user_id', userId),
    admin.from('admin_users').select('user_id').eq('user_id', userId).limit(1),
  ])
  if (memberships.error || admins.error || admins.data.length) return false
  return permitsPinTarget(memberships.data, tenantId, driver)
}

export async function setAuthUserPin(input: {
  admin: AuthAdmin
  userId?: string | null
  email: string
  pin: string
  fullName: string
  phone: string
  accountType: 'driver' | 'fleet_owner'
  tenantId: string
}): Promise<ApplyPinResult> {
  const metadata = {
    full_name: input.fullName,
    phone: input.phone,
    account_type: input.accountType,
  }
  // Every create / update / verify path uses the same server-only transform.
  const password = authPasswordFromPin(input.pin)

  if (input.userId) {
    const safe = await isSafePinTarget(input.admin, input.userId, input.tenantId, input.accountType === 'driver')
    if (!safe) return { ok: false, error: 'This account cannot be reset for this fleet', status: 403 }
    const { error } = await input.admin.auth.admin.updateUserById(input.userId, {
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { [MUST_CHANGE_PIN_KEY]: true },
    })
    if (error) return { ok: false, error: error.message, status: 400 }
    return { ok: true, userId: input.userId, created: false }
  }

  const created = await input.admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { [MUST_CHANGE_PIN_KEY]: true },
  })

  if (!created.error && created.data.user) {
    return { ok: true, userId: created.data.user.id, created: true }
  }

  const already = created.error?.message.toLowerCase().includes('already')
  if (!already) {
    return { ok: false, error: created.error?.message || 'Could not create a login', status: 400 }
  }

  // Never claim an existing account by its phone-derived email.
  return { ok: false, error: 'That phone number already has a login. Link it securely before resetting its PIN.', status: 409 }
}

export async function recordPinReset(admin: AuthAdmin, input: PinResetLogInput): Promise<void> {
  const { error } = await admin.from('pin_reset_log').insert({
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    target_kind: input.targetKind,
    target_user_id: input.targetUserId || null,
    target_driver_id: input.targetDriverId || null,
    tenant_id: input.tenantId || null,
  })
  if (error) {
    console.error('pin_reset_log insert failed', error.message)
  }
}

export function ownerEmailFromPhone(phone: string): string {
  return phoneAuthEmail(phone)
}

export { actorRoleLabel }
