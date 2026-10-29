import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchReportPages, reportLookbackStart, trailingDateRange, validReportRange } from './report-range'

test('report windows are inclusive and cross years and leap days', () => {
  assert.deepEqual(trailingDateRange(1, new Date(2024, 1, 29)), { start: '2024-02-29', end: '2024-02-29' })
  assert.deepEqual(trailingDateRange(3, new Date(2024, 2, 1)), { start: '2024-02-28', end: '2024-03-01' })
  assert.deepEqual(trailingDateRange(7, new Date(2025, 0, 2)), { start: '2024-12-27', end: '2025-01-02' })
  assert.throws(() => trailingDateRange(0), /at least one day/)
})

test('fuel lookback crosses month/year/leap boundaries and rejects invalid input', () => {
  assert.equal(reportLookbackStart('2026-10-29'), '2026-08-30')
  assert.equal(reportLookbackStart('2026-01-10', 60), '2025-11-11')
  assert.equal(reportLookbackStart('2024-03-01', 1), '2024-02-29')
  assert.equal(reportLookbackStart('2026-10-29', 0), '2026-10-29')
  assert.throws(() => reportLookbackStart('2026-02-30'), /Invalid report lookback/)
  assert.throws(() => reportLookbackStart('2026-10-29', -1), /Invalid report lookback/)
})

test('custom report ranges require real dates in chronological order', () => {
  assert.equal(validReportRange({ start: '2024-02-29', end: '2024-03-01' }), true)
  assert.equal(validReportRange({ start: '2023-02-29', end: '2024-03-01' }), false)
  assert.equal(validReportRange({ start: '2024-03-02', end: '2024-03-01' }), false)
  assert.equal(validReportRange({ start: '', end: '2024-03-01' }), false)
})

test('a short first page completes without requesting an exact count', async () => {
  const calls: Array<{ from: number; to: number; withCount: boolean }> = []
  const rows = await fetchReportPages(async (from, to, withCount) => {
    calls.push({ from, to, withCount })
    return { data: [{ id: 'a' }, { id: 'b' }], error: null, count: null }
  }, 5)
  assert.deepEqual(rows, [{ id: 'a' }, { id: 'b' }])
  assert.deepEqual(calls, [{ from: 0, to: 4, withCount: false }])
  assert.deepEqual(await fetchReportPages(async () => ({ data: [], error: null }), 5), [])
})

test('a full first page gets the count on page two, then remaining pages run in parallel', async () => {
  const source = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }))
  const calls: Array<[number, number, boolean]> = []
  let active = 0
  let maxActive = 0
  const rows = await fetchReportPages(async (from, to, withCount) => {
    calls.push([from, to, withCount])
    if (from >= 4) {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    }
    return { data: source.slice(from, to + 1), error: null, count: withCount ? source.length : null }
  }, 2)
  assert.deepEqual(rows, source)
  assert.deepEqual(calls, [[0, 1, false], [2, 3, true], [4, 5, false], [6, 7, false], [8, 9, false], [10, 11, false]])
  assert.equal(maxActive, 4)
})

test('an exact full final page stops as soon as the counted page completes the total', async () => {
  const source = [1, 2, 3, 4]
  const ranges: Array<[number, number, boolean]> = []
  const rows = await fetchReportPages(async (from, to, withCount) => {
    ranges.push([from, to, withCount])
    return { data: source.slice(from, to + 1), error: null, count: withCount ? source.length : null }
  }, 2)
  assert.deepEqual(rows, source)
  assert.deepEqual(ranges, [[0, 1, false], [2, 3, true]])
})

test('missing or invalid exact counts fail rather than presenting partial totals', async () => {
  for (const count of [null, undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(fetchReportPages(async (from, to, withCount) => ({
      data: from === 0 ? [1, 2] : [], error: null, count: withCount ? count : null,
    }), 2), /verify that the report is complete/)
  }
})

test('concurrent page overlap or count changes never yield a silently skewed total', async () => {
  await assert.rejects(fetchReportPages(async (from, to, withCount) => ({
    data: from === 0 ? [{ id: 'a' }, { id: 'b' }] : from === 2 ? [{ id: 'b' }, { id: 'c' }] : [{ id: 'd' }, { id: 'e' }],
    error: null, count: withCount ? 6 : null,
  }), 2), /changed while loading/)
  await assert.rejects(fetchReportPages(async (from, to, withCount) => ({
    data: from === 0 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'c' }, { id: 'd' }],
    error: null, count: withCount ? 3 : null,
  }), 2), /changed while loading/)
  await assert.rejects(fetchReportPages(async (from, to, withCount) => ({
    data: from === 4 ? [{ id: 'e' }] : [{ id: String(from) }, { id: String(from + 1) }],
    error: null, count: withCount ? 6 : null,
  }), 2), /changed while loading/)
})

test('page errors surface instead of partial totals', async () => {
  await assert.rejects(fetchReportPages(async () => ({ data: null, error: { message: 'network failed' } }), 2), /network failed/)
  await assert.rejects(fetchReportPages(async (from) => ({
    data: from === 0 ? [1, 2] : null,
    error: from === 0 ? null : { message: 'network failed' },
    count: from === 0 ? null : 4,
  }), 2), /network failed/)
  await assert.rejects(fetchReportPages(async () => ({ data: [], error: null }), 0), /Invalid report page size/)
})
