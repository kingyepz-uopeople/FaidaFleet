'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ActiveTenantState = {
  /** First active membership's tenant id; null until loaded or when missing. */
  tenantId: string | null
  /** Auth user id (used for recorded_by columns). */
  userId: string | null
  loading: boolean
  /** Set when the user has no active membership; pages must not mutate. */
  error: string | null
  /** Bump to re-run the lookup (e.g. after onboarding). */
  reload: () => void
}

/**
 * Resolves the current user's active tenant without `.single()`, which threw
 * for users with more than one membership. Users with several memberships get
 * their oldest active tenant; tenant switching is out of scope for now.
 */
export function useActiveTenant(): ActiveTenantState {
  const router = useRouter()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function resolve() {
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        if (cancelled) return
        setUserId(user.id)

        const { data: memberships, error: membershipError } = await supabase
          .from('memberships')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)

        if (membershipError) throw membershipError
        if (!memberships || memberships.length === 0) {
          setTenantId(null)
          setError('No active fleet membership was found for your account. Complete onboarding or contact support.')
          return
        }
        setTenantId(memberships[0].tenant_id)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your fleet membership.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, router])

  return {
    tenantId,
    userId,
    loading,
    error,
    reload: () => setNonce((value) => value + 1),
  }
}
