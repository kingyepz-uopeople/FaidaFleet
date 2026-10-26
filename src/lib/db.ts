import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Supabase mutation helpers.
 *
 * PostgREST only returns an error for real failures. A row level security
 * denial on UPDATE / DELETE is not an error — the statement simply matches
 * zero rows. Every mutation therefore has to append `.select()` and check the
 * number of rows that came back, otherwise the UI reports success while
 * nothing was written.
 */

export type MutationResult<T> = {
  data: T[] | null
  error: PostgrestError | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

/** Throws a readable error when a value is not a database UUID. */
export function requireUuid(value: unknown, label: string): string {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!isUuid(candidate)) {
    throw new Error(`Select a valid ${label} before continuing`)
  }
  return candidate
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  '42501': 'Your account does not have permission for this change. Ask a system administrator to check your role.',
  '42P01': 'That table is missing from the database. Apply the pending Supabase migrations, then try again.',
  '42883': 'A database function is missing. Apply the pending Supabase migrations, then try again.',
  '23505': 'That value already exists. Use a different name or number.',
  '23503': 'That record is linked to other data, so it cannot be changed this way.',
  '23502': 'A required field is missing.',
  '22P02': 'One of the values is not in the expected format.',
  'PGRST116': 'The record could not be found.',
  'PGRST301': 'Your session expired. Sign in again and retry.',
}

export function describeDbError(error: PostgrestError | null | undefined, action: string): string {
  if (!error) return ''
  const friendly = FRIENDLY_MESSAGES[error.code || '']
  const detail = error.message || error.details || 'Unknown database error'
  if (friendly) return `${action}: ${friendly} (${detail})`
  return `${action}: ${detail}`
}

export type AssertOptions = {
  /** Rows the statement must touch. Use 0 to skip the row-count check. */
  expectsRows?: number
  /** Extra context shown when zero rows come back. */
  zeroRowHint?: string
}

/**
 * Turns a `{ data, error }` mutation response into either the affected rows or
 * a thrown Error that can be surfaced to the user.
 */
export function assertMutation<T>(
  result: MutationResult<T>,
  action: string,
  { expectsRows = 1, zeroRowHint }: AssertOptions = {},
): T[] {
  if (result.error) {
    throw new Error(describeDbError(result.error, action))
  }
  const rows = result.data || []
  if (expectsRows > 0 && rows.length < expectsRows) {
    throw new Error(
      zeroRowHint ||
        `${action}: nothing was saved. Your account may not have permission for this record, or it no longer exists.`,
    )
  }
  return rows
}

/** Convenience wrapper for a single expected row (insert / update by id). */
export function assertMutationRow<T>(
  result: MutationResult<T>,
  action: string,
  zeroRowHint?: string,
): T {
  const rows = assertMutation(result, action, { expectsRows: 1, zeroRowHint })
  return rows[0]
}
