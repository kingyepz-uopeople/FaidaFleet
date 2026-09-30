import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { supabaseCredentials } from '@/lib/supabase/env'

export function createClient() {
  const { url, key } = supabaseCredentials()
  return createBrowserClient<Database>(url, key)
}
