import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/env'

export function createClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseKey())
}
