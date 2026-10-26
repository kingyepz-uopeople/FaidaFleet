'use server'

import { createClient } from '@/lib/supabase/server'

export type SettingEntry = {
  key: string
  value: unknown
}

export type SaveSettingsResult = {
  success: boolean
  error?: string
  saved?: number
}

/**
 * Whitelist of keys the admin settings screen may write. Anything else in the
 * request is dropped before it reaches the database.
 */
const ALLOWED_KEYS = new Set([
  'mpesa_api_key',
  'mpesa_consumer_key',
  'email_notifications',
  'sms_notifications',
  'maintenance_mode',
])

/**
 * System settings (including M-Pesa credentials) are written server-side so
 * secrets never pass through client JavaScript. Runs with the caller's
 * cookie session, so the system_settings RLS policies still apply.
 */
export async function saveSystemSettings(
  entries: SettingEntry[],
): Promise<SaveSettingsResult> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { success: false, error: 'There are no settings to save.' }
  }

  const clean = entries.filter(
    (entry): entry is SettingEntry =>
      typeof entry?.key === 'string' && ALLOWED_KEYS.has(entry.key),
  )

  if (clean.length === 0) {
    return { success: false, error: 'None of the submitted settings are allowed.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'You must be signed in to save settings.' }
  }

  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_system_admin')
  if (rpcError || !isAdmin) {
    return { success: false, error: 'System administrator access required.' }
  }

  let saved = 0
  for (const entry of clean) {
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({ key: entry.key, value: entry.value }, { onConflict: 'key' })
      .select('key')

    if (error) {
      return {
        success: false,
        error: `Could not save ${entry.key}: ${error.message}`,
      }
    }
    if (!data || data.length === 0) {
      return {
        success: false,
        error: `The database blocked the change to ${entry.key} (row-level security).`,
      }
    }
    saved += 1
  }

  return { success: true, saved }
}
