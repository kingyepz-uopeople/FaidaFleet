import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Every write in the app goes through these helpers. A Supabase mutation can
 * return `{ error: null, data: [] }` when RLS silently filters the row out,
 * so we always chain `.select()` and treat zero rows as a failed, reported
 * mutation instead of a silent no-op.
 */

const PERMISSION_HINTS = [
  'row-level security',
  'rls',
  'permission',
  'not found',
  'duplicate',
  'unique',
  'foreign key',
  'check constraint',
  'violates',
]

export function friendlyDbError(error: PostgrestError | Error | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.'
  const message = error.message || 'Something went wrong. Please try again.'
  const lower = message.toLowerCase()
  if (lower.includes('duplicate') || lower.includes('unique')) {
    return 'That record already exists. Check for a duplicate and try again.'
  }
  if (lower.includes('foreign key')) {
    return 'A linked record is missing, so the change could not be saved.'
  }
  if (lower.includes('check constraint')) {
    return 'One of the values is not allowed. Check the form and try again.'
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Your account does not have permission to make this change. Contact a system administrator if this is unexpected.'
  }
  if (PERMISSION_HINTS.some((hint) => lower.includes(hint))) {
    return message
  }
  return message
}

/** Supabase query builders are thenables (PromiseLike), not full Promises. */
type MaybeThenable<T> = T | PromiseLike<T>

type MutationResult<T> = {
  data: T[] | null
  error: PostgrestError | null
}

/**
 * Awaits an insert/update/delete builder that was terminated with `.select()`.
 * Throws a human-readable Error on a Supabase error or when RLS filtered out
 * every row (0 rows affected).
 */
export async function requireRows<T>(
  builder: MaybeThenable<MutationResult<T>>,
  entityLabel: string,
  action: 'create' | 'update' | 'delete' | 'save' = 'save',
): Promise<T[]> {
  const result = await builder
  if (result.error) {
    throw new Error(friendlyDbError(result.error))
  }
  if (!result.data || result.data.length === 0) {
    const verb =
      action === 'create'
        ? 'could not be created'
        : action === 'update'
          ? 'could not be updated'
          : action === 'delete'
            ? 'could not be deleted'
            : 'could not be saved'
    throw new Error(
      `The ${entityLabel} ${verb}. The database blocked the change (row-level security or a missing record).`,
    )
  }
  return result.data
}

/**
 * Variant for upserts / single-row builders that return one object instead of
 * an array. Still throws on error or a missing row.
 */
export async function requireSingle<T>(
  builder: MaybeThenable<{ data: T | null; error: PostgrestError | null }>,
  entityLabel: string,
  action: 'create' | 'update' | 'delete' | 'save' = 'save',
): Promise<T> {
  const result = await builder
  if (result.error) {
    throw new Error(friendlyDbError(result.error))
  }
  if (!result.data) {
    const verb =
      action === 'create'
        ? 'could not be created'
        : action === 'update'
          ? 'could not be updated'
          : action === 'delete'
            ? 'could not be deleted'
            : 'could not be saved'
    throw new Error(
      `The ${entityLabel} ${verb}. The database blocked the change (row-level security or a missing record).`,
    )
  }
  return result.data
}
