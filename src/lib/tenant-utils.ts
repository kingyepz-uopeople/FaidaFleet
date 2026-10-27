// Tenant Management Utilities
// Helper functions for working with tenants in your app

import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { primaryMembership } from '@/lib/fleet-access'
import type { Tenant, Membership, UserRole } from '@/lib/database.types'

type MembershipWithTenant = Membership & { tenants: Tenant | null }

/**
 * Get all tenants the current user belongs to (client-side)
 */
export async function getUserTenants() {
  const supabase = createBrowserClient()

  const { data: memberships, error } = await supabase
    .from('memberships')
    .select(`
      *,
      tenants:tenant_id (*)
    `)
    .eq('is_active', true)
    .order('joined_at', { ascending: false })

  if (error) throw error

  return (memberships || []).map((row) => {
    const membership = row as MembershipWithTenant
    return { membership, tenant: membership.tenants as Tenant }
  })
}

/**
 * Get all of the current user's roles in a specific tenant.
 * A user can legitimately have several active memberships, so all callers
 * below work with an array instead of .single()/.maybeSingle().
 */
async function getMyRolesInTenant(tenantId: string): Promise<UserRole[]> {
  const supabase = createBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error) return []
  return (data || []).map((row) => row.role as UserRole).filter(Boolean)
}

/** Get the primary role of the current user in a tenant (client-side). */
export async function getUserRoleInTenant(tenantId: string): Promise<UserRole | null> {
  const roles = await getMyRolesInTenant(tenantId)
  const primary = primaryMembership(roles.map((role) => ({ tenant_id: tenantId, role })))
  return (primary?.role as UserRole | undefined) || null
}

/** Check if user has a specific role in tenant (client-side). */
export async function hasRole(tenantId: string, role: UserRole): Promise<boolean> {
  const roles = await getMyRolesInTenant(tenantId)
  return roles.includes(role)
}

/** Check if user has any of the specified roles (client-side). */
export async function hasAnyRole(tenantId: string, roles: UserRole[]): Promise<boolean> {
  const myRoles = await getMyRolesInTenant(tenantId)
  return myRoles.some((role) => roles.includes(role))
}

/**
 * Get user's first/default tenant (client-side)
 * Useful for initial app load
 */
export async function getDefaultTenant(): Promise<{ tenant: Tenant; membership: Membership } | null> {
  const tenants = await getUserTenants()
  if (tenants.length === 0) return null

  return {
    tenant: tenants[0].tenant,
    membership: tenants[0].membership
  }
}

/**
 * Create a new tenant and add creator as owner (client-side)
 */
export async function createTenant(data: {
  name: string
  businessName?: string
  phone?: string
  email?: string
  plan?: 'starter' | 'pro' | 'enterprise'
}): Promise<Tenant> {
  const supabase = createBrowserClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Tenants and the owner membership are created together by a SECURITY
  // DEFINER function. Migration 009 removes the raw tenants INSERT policy, so
  // inserting here would fail RLS and leave an orphan tenant behind.
  const { data: created, error: createError } = await supabase.rpc('create_tenant_with_owner', {
    tenant_name: data.name,
    tenant_business_name: data.businessName || null,
    tenant_phone: data.phone || null,
    tenant_email: data.email || null,
    tenant_plan: data.plan || 'starter',
  })

  if (createError) throw createError

  const tenantId = (created as { tenant_id?: string } | null)?.tenant_id
  if (!tenantId) throw new Error('The fleet was created but no id came back. Reload and try again.')

  const { data: tenants, error: readError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .limit(1)

  if (readError || !tenants || tenants.length === 0) {
    throw readError || new Error('The fleet was created but could not be read back.')
  }

  return tenants[0] as Tenant
}

/**
 * Invite user to tenant (requires owner/admin role)
 */
export async function inviteUserToTenant(
  tenantId: string,
  email: string,
  role: UserRole
) {
  const hasPermission = await hasAnyRole(tenantId, ['owner', 'admin'])
  if (!hasPermission) {
    throw new Error('Insufficient permissions to invite users')
  }

  // In a real implementation, you would:
  // 1. Send invitation email
  // 2. Create invitation record
  // 3. User accepts invitation
  // 4. Create membership

  // For now, this is a placeholder
  // You'll need to implement the full invitation flow with Edge Functions

  console.log(`Invitation would be sent to ${email} for tenant ${tenantId} with role ${role}`)

  // TODO: Implement full invitation system
  throw new Error('Invitation system not yet implemented')
}

/** Check if user is member of tenant (server-side). */
export async function isUserMemberOfTenant(tenantId: string): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)

  return !error && (data?.length || 0) > 0
}

/** Get the primary role of the current user in a tenant (server-side). */
export async function getUserRoleInTenantServer(tenantId: string): Promise<UserRole | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error) return null
  const primary = primaryMembership(data || [])
  return (primary?.role as UserRole | undefined) || null
}

/** Role hierarchy check - useful for permission gates */
export function isRoleHigherOrEqual(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    owner: 4,
    admin: 3,
    accountant: 2,
    driver: 1
  }

  return hierarchy[userRole] >= hierarchy[requiredRole]
}

/** Format role for display */
export function formatRole(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/** Get role color for badges */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    accountant: 'bg-green-100 text-green-800',
    driver: 'bg-gray-100 text-gray-800'
  }

  return colors[role]
}
