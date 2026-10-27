import { headers } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { MembershipLike } from '@/lib/fleet-access'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import { decodeFleetContext, FLEET_CONTEXT_HEADER } from '@/lib/supabase/request-context'

type RequestFleetAccess = {
  user: User | null
  memberships: MembershipLike[] | null
  membershipError: string | null
}

/**
 * Called only from protected app server components. The middleware strips any
 * incoming copy of this header before inserting its verified result. If no
 * result was forwarded, fail back to the original authenticated DB lookup.
 */
export async function requestFleetAccess(): Promise<RequestFleetAccess> {
  const forwarded = decodeFleetContext((await headers()).get(FLEET_CONTEXT_HEADER))
  if (forwarded) return { ...forwarded, membershipError: null }
  if (!hasSupabaseEnv()) return { user: null, memberships: null, membershipError: null }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { user: null, memberships: null, membershipError: null }

    // One user may have several active memberships; do not use .single().
    const { data: memberships, error } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)

    return { user, memberships, membershipError: error?.message || null }
  } catch (error) {
    console.error('Could not resolve fleet access:', error)
    return { user: null, memberships: null, membershipError: null }
  }
}
