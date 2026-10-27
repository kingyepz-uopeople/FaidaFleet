/**
 * Helpers for the record-entry forms (trips, collections, expenses,
 * maintenance). All four tables have a nullable `recorded_by uuid` column that
 * references auth.users(id); driver RLS policies use it to let a driver read
 * back rows they created themselves.
 */

/** Only inserts get recorded_by. Edits must never overwrite the original author. */
export function withRecordedBy<T extends object>(
  payload: T,
  userId: string | null | undefined,
): T & { recorded_by: string } {
  if (!userId) {
    throw new Error('Your session has expired. Sign in again before recording this entry.')
  }
  return { ...payload, recorded_by: userId }
}

/** Optional form fields are stored as NULL rather than whitespace. */
export function optionalNotes(value: string | null | undefined): string | null {
  const trimmed = (value || '').trim()
  return trimmed || null
}
