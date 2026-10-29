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

/** Start of a bounded lookback window, using calendar days in UTC. */
export function reportLookbackStart(start: string, lookbackDays = 60): string {
  if (!validReportRange({ start, end: start }) || !Number.isInteger(lookbackDays) || lookbackDays < 0) {
    throw new Error('Invalid report lookback')
  }
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - lookbackDays)
  return date.toISOString().slice(0, 10)
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
 * Read every row in a stable, uniquely ordered report range. The first page is
 * fetched without an exact count: a short page is already complete. Only when
 * the first page is full do we ask for an exact count (on the second page), then
 * fetch all remaining pages in parallel. Callers must select each row's id and
 * use a page size no larger than the server's response cap. Overlap or count
 * changes while paging are surfaced instead of silently skewing totals.
 */
export async function fetchReportPages<T>(
  fetchPage: (from: number, to: number, withCount: boolean) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
    count?: number | null
  }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid report page size')

  const first = await fetchPage(0, pageSize - 1, false)
  if (first.error) throw new Error(first.error.message)
  const rows: T[] = first.data || []
  if (rows.length < pageSize) return rows

  const second = await fetchPage(pageSize, pageSize * 2 - 1, true)
  if (second.error) throw new Error(second.error.message)
  if (typeof second.count !== 'number' || !Number.isSafeInteger(second.count) || second.count < 0) {
    throw new Error('Could not verify that the report is complete. Please try again.')
  }
  const expectedCount = second.count
  if (expectedCount < rows.length) throw new Error('The report changed while loading. Please try again.')
  const seenIds = new Set<string>()
  const addPage = (page: T[], from: number) => {
    if (from + page.length > expectedCount) throw new Error('The report changed while loading. Please try again.')
    for (const row of page) {
      if (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') {
        if (seenIds.has(row.id)) throw new Error('The report changed while loading. Please try again.')
        seenIds.add(row.id)
      }
    }
    rows.push(...page)
  }
  for (const row of rows) {
    if (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') seenIds.add(row.id)
  }
  addPage(second.data || [], pageSize)
  if (rows.length === expectedCount) return rows
  if (rows.length > expectedCount || (second.data || []).length < pageSize) {
    throw new Error('The report changed while loading. Please try again.')
  }

  const offsets: number[] = []
  for (let from = rows.length; from < expectedCount; from += pageSize) offsets.push(from)
  const pages = await Promise.all(offsets.map(async (from) => {
    const to = Math.min(from + pageSize - 1, expectedCount - 1)
    const result = await fetchPage(from, to, false)
    if (result.error) throw new Error(result.error.message)
    return { from, to, data: result.data || [] }
  }))
  for (const page of pages) {
    if (page.data.length !== page.to - page.from + 1) {
      throw new Error('The report changed while loading. Please try again.')
    }
    addPage(page.data, page.from)
  }
  if (rows.length !== expectedCount) throw new Error('The report changed while loading. Please try again.')
  return rows
}
