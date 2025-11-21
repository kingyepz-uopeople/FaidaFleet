// Tenant Management Utilities
// Helper functions for working with tenants in your app

import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { Tenant, Membership, UserRole } from '@/lib/database.types'

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
  
  return (memberships || []).map(m => ({
    membership: m as Membership,
    tenant: (m as any).tenants as Tenant
  }))
}

/**
 * Get user's role in a specific tenant (client-side)
 */
export async function getUserRoleInTenant(tenantId: string): Promise<UserRole | null> {
  const supabase = createBrowserClient()
  
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return (data as any).role as UserRole
}

/**
 * Check if user has specific role in tenant (client-side)
 */
export async function hasRole(tenantId: string, role: UserRole): Promise<boolean> {
  const userRole = await getUserRoleInTenant(tenantId)
  return userRole === role
}

/**
 * Check if user has any of the specified roles (client-side)
 */
export async function hasAnyRole(tenantId: string, roles: UserRole[]): Promise<boolean> {
  const userRole = await getUserRoleInTenant(tenantId)
  return userRole ? roles.includes(userRole) : false
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
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: data.name,
      business_name: data.businessName,
      phone: data.phone,
      email: data.email,
      plan: data.plan || 'starter'
    } as any)
    .select()
    .single()

  if (tenantError || !tenant) throw tenantError

  // Add user as owner
  const { error: membershipError } = await supabase
    .from('memberships')
    .insert({
      user_id: user.id,
      tenant_id: (tenant as any).id,
      role: 'owner'
    } as any)

  if (membershipError) throw membershipError

  return tenant as Tenant
}

/**
 * Invite user to tenant (requires owner/admin role)
 */
export async function inviteUserToTenant(
  tenantId: string,
  email: string,
  role: UserRole
) {
  const supabase = createBrowserClient()
  
  // Check if current user has permission
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

/**
 * Check if user is member of tenant (server-side)
 */
export async function isUserMemberOfTenant(tenantId: string): Promise<boolean> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single()

  return !error && data !== null
}

/**
 * Get user's role in tenant (server-side)
 */
export async function getUserRoleInTenantServer(tenantId: string): Promise<UserRole | null> {
  const supabase = await createServerClient()
  
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return (data as any).role as UserRole
}

/**
 * Role hierarchy check - useful for permission gates
 */
export function isRoleHigherOrEqual(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    owner: 4,
    admin: 3,
    accountant: 2,
    driver: 1
  }
  
  return hierarchy[userRole] >= hierarchy[requiredRole]
}

/**
 * Format role for display
 */
export function formatRole(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Get role color for badges
 */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    accountant: 'bg-green-100 text-green-800',
    driver: 'bg-gray-100 text-gray-800'
  }
  
  return colors[role]
}
