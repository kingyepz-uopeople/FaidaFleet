/**
 * Shared, client-safe rules for memberships and driver navigation.
 *
 * A user can have more than one active membership (for example a driver in one
 * fleet and an owner in another). Never use .single()/.maybeSingle() on
 * memberships: pick a deterministic primary membership instead.
 */
import type { User } from '@supabase/supabase-js'
import { needsPinChange } from './pin'

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

/** Roles that are allowed to see the full fleet-owner menu. */
export function isFleetManagerRole(role: string | null | undefined): boolean {
  return ['owner', 'admin', 'accountant'].includes((role || '').toLowerCase())
}

/** The essential access facts shared by the server layout and the provider. */
export type MembershipAccess = {
  role: string | null
  isDriver: boolean
  tenantId: string | null
}

export function membershipAccess(rows: MembershipLike[] | null | undefined): MembershipAccess {
  const primary = primaryMembership(rows)
  return {
    role: primary?.role || null,
    isDriver: isDriverOnly(rows),
    tenantId: primary?.tenant_id || null,
  }
}

/**
 * Serializable result of the server layout's session + membership lookup.
 * `ready` is false when the server could not resolve access (no session, no
 * Supabase env, or a failed query), so the client falls back to its own load.
 */
export type FleetAccessSnapshot = MembershipAccess & {
  ready: boolean
  user: User | null
  mustChangePin: boolean
}

export const EMPTY_FLEET_ACCESS_SNAPSHOT: FleetAccessSnapshot = {
  ready: false,
  user: null,
  role: null,
  isDriver: false,
  mustChangePin: false,
  tenantId: null,
}

export function accessFromMemberships(
  rows: MembershipLike[] | null | undefined,
  user: User | null,
): FleetAccessSnapshot {
  // An account with no active membership is not ready for the fleet menu:
  // keep the neutral skeleton rather than guessing "Member" / owner links.
  return {
    ready: Boolean(user) && Boolean(rows && rows.length > 0),
    user,
    ...membershipAccess(rows),
    mustChangePin: needsPinChange(user),
  }
}

/**
 * Loading phases for the shell. A ready server snapshot means the role is
 * known on first paint (no skeleton), while a driver's scope lookup can still
 * be running in the background. `loading` gates data-dependent counts.
 */
export type FleetAccessPhases = {
  loading: boolean
  roleLoading: boolean
  scopeLoading: boolean
}

export function fleetAccessPhases(
  snapshot: Pick<FleetAccessSnapshot, 'ready' | 'isDriver'>,
): FleetAccessPhases {
  return {
    loading: !snapshot.ready || snapshot.isDriver,
    roleLoading: !snapshot.ready,
    scopeLoading: snapshot.ready && snapshot.isDriver,
  }
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
