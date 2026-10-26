import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getSupabaseUrl } from '@/lib/supabase/env'

/**
 * Server-only Supabase client initialized with the SERVICE_ROLE key.
 * Used exclusively for administrative server actions (e.g., auth.admin.inviteUserByEmail).
 * NEVER import this file in client components ('use client') or expose SUPABASE_SERVICE_ROLE_KEY to NEXT_PUBLIC_*.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const url = getSupabaseUrl()

  if (!serviceRoleKey || !url) {
    return null
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
