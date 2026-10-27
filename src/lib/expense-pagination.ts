/** Cursor for the expense log's created_at DESC NULLS FIRST, date DESC, id DESC ordering. */
export type ExpenseCursor = { created_at: string | null; date: string; id: string }

/**
 * Continue strictly after the last displayed row, rather than using an offset
 * that can skip records if an earlier expense is deleted between requests.
 * Values come from typed database columns (timestamp, date, UUID), not input.
 */
export function expenseCursorFilter(cursor: ExpenseCursor): string {
  const sameDate = `date.eq.${cursor.date},id.lt.${cursor.id}`
  if (cursor.created_at === null) {
    return [
      `and(created_at.is.null,date.lt.${cursor.date})`,
      `and(created_at.is.null,${sameDate})`,
      'created_at.not.is.null',
    ].join(',')
  }
  return [
    `created_at.lt.${cursor.created_at}`,
    `and(created_at.eq.${cursor.created_at},date.lt.${cursor.date})`,
    `and(created_at.eq.${cursor.created_at},${sameDate})`,
  ].join(',')
}

/** Keep a look-ahead row out of the list and its totals. */
export function splitExpensePage<T>(rows: T[], pageSize: number, count: number | null = null): { rows: T[]; hasMore: boolean } {
  const visible = rows.slice(0, pageSize)
  return { rows: visible, hasMore: count === null ? rows.length > pageSize : count > visible.length }
}

/** A concurrently edited row must not be counted twice across pages. */
export function appendUniqueExpenses<T extends { id: string }>(existing: T[], page: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id))
  return [...existing, ...page.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })]
}
