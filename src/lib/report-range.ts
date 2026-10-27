/** Inclusive local calendar dates for a trailing reporting window. */
export function trailingDateRange(days: number, today = new Date()): { start: string; end: string } {
  if (!Number.isInteger(days) || days < 1) throw new Error('A reporting range must contain at least one day')
  const dateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return {
    start: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1)),
    end: dateKey(today),
  }
}

export function validReportRange(range: { start: string; end: string }): boolean {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  }
  return validDate(range.start) && validDate(range.end) && range.start <= range.end
}

/**
 * PostgREST caps response sizes. Read every row in the selected date range in
 * small pages so a report never presents a truncated page as a complete total.
 * The caller must provide a stable, unique ordering, select each row's id,
 * bound report dates, and request an exact count on the first page. Obvious
 * overlap or count growth while paging is surfaced instead of double-counted.
 */
export async function fetchReportPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
    count?: number | null
  }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid report page size')
  const rows: T[] = []
  const seenIds = new Set<string>()
  let expectedCount: number | null = null
  for (let from = 0; ;) {
    const { data, error, count } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (expectedCount === null) {
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
        throw new Error('Could not verify that the report is complete. Please try again.')
      }
      expectedCount = count
    }
    const page = data || []
    if (page.length === 0) {
      if (expectedCount !== null && from < expectedCount) {
        throw new Error('The report changed while loading. Please try again.')
      }
      return rows
    }
    if (from + page.length > expectedCount) {
      throw new Error('The report changed while loading. Please try again.')
    }
    for (const row of page) {
      if (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') {
        if (seenIds.has(row.id)) throw new Error('The report changed while loading. Please try again.')
        seenIds.add(row.id)
      }
    }
    rows.push(...page)
    // A project can cap PostgREST responses below our requested page size.
    // Advance by what was actually received and use the first exact count to
    // avoid silently mistaking that cap for the end of the report.
    from += page.length
    if (from === expectedCount) return rows
  }
}
