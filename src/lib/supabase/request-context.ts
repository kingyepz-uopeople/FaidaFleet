import type { User } from '@supabase/supabase-js'
import type { MembershipLike } from '@/lib/fleet-access'

/**
 * This header is an internal hand-off, not an authentication credential.
 * Middleware MUST remove the incoming copy before setting its own value. It is
 * only read by server components behind the middleware matcher, never by an
 * API route or as a substitute for database RLS.
 */
export const FLEET_CONTEXT_HEADER = 'x-faidafleet-verified-context'
const MAX_CONTEXT_LENGTH = 4096

export type VerifiedFleetContext = {
  user: User
  memberships: MembershipLike[]
}

export function sanitizedRequestHeaders(incoming: Headers): Headers {
  const headers = new Headers(incoming)
  headers.delete(FLEET_CONTEXT_HEADER)
  // Do not forward a client-supplied copy of Next's internal override header.
  headers.delete(`x-middleware-request-${FLEET_CONTEXT_HEADER}`)
  return headers
}

export function encodeFleetContext(context: VerifiedFleetContext): string | null {
  try {
    // Percent encoding keeps Unicode and control characters safe for headers.
    const encoded = encodeURIComponent(JSON.stringify(context))
    // An unusually large auth profile must not turn a page into a 431 error.
    // In that rare case the server does the normal authenticated lookup.
    return encoded.length <= MAX_CONTEXT_LENGTH ? encoded : null
  } catch {
    return null
  }
}

export function decodeFleetContext(value: string | null): VerifiedFleetContext | null {
  if (!value || value.length > MAX_CONTEXT_LENGTH) return null
  try {
    const context: unknown = JSON.parse(decodeURIComponent(value))
    if (!context || typeof context !== 'object') return null
    const { user, memberships } = context as Partial<VerifiedFleetContext>
    if (!user || typeof user.id !== 'string' || !user.id || !Array.isArray(memberships)) return null
    if (!memberships.every((row) => (
      row && typeof row.tenant_id === 'string' &&
      (typeof row.role === 'string' || row.role === null)
    ))) return null
    return { user, memberships }
  } catch {
    return null
  }
}
