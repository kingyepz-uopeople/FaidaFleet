const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Supabase rows are keyed by v4 UUIDs. Reject anything else before a query. */
export function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Throw a consistent error when an id that must exist is missing or malformed. */
export function assertUuid(value: string | null | undefined, label: string): asserts value is string {
  if (!isValidUuid(value)) {
    throw new Error(`${label} is missing or invalid. Reload the page and try again.`)
  }
}
