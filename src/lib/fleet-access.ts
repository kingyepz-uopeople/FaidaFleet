/**
 * Shared, client-safe rules for memberships and driver navigation.
 *
 * A user can have more than one active membership (for example a driver in one
 * fleet and an owner in another). Never use .single()/.maybeSingle() on
 * memberships: pick a deterministic primary membership instead.
 */

export type MembershipLike = { tenant_id: string; role: string | null }

const ROLE_PRIORITY = ['owner', 'admin', 'accountant', 'driver']

export function primaryMembership<T extends MembershipLike>(rows: T[] | null | undefined): T | null {
  const list = rows || []
  if (list.length === 0) return null
  for (const role of ROLE_PRIORITY) {
    const found = list.find((row) => row.role === role)
    if (found) return found
  }
  return list[0] || null
}

export function membershipRoles(rows: MembershipLike[] | null | undefined): string[] {
  return (rows || []).map((row) => row.role || '').filter(Boolean)
}

/** Driver experience only applies when every active membership is a driver one. */
export function isDriverOnly(rows: MembershipLike[] | null | undefined): boolean {
  const roles = membershipRoles(rows)
  return roles.length > 0 && roles.every((role) => role === 'driver')
}

export function isDriverRole(role: string | null | undefined): boolean {
  return (role || '').toLowerCase() === 'driver'
}

export function homePathForRole(role: string | null | undefined): string {
  return isDriverRole(role) ? '/trips' : '/dashboard'
}

/** Paths a driver-only account is allowed to open. Everything else redirects. */
export const DRIVER_ALLOWED_PREFIXES = [
  '/trips',
  '/collections',
  '/expenses',
  '/maintenance',
  '/settings',
  '/help',
]

export function isPathAllowedForDriver(pathname: string): boolean {
  return DRIVER_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/** Strip query strings so nav links such as /expenses?new=fuel highlight correctly. */
export function navPath(href: string): string {
  return href.split('?')[0]
}

export function isNavActive(pathname: string, href: string): boolean {
  const path = navPath(href)
  return pathname === path || pathname.startsWith(`${path}/`)
}
