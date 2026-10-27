import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchReportPages, trailingDateRange, validReportRange } from './report-range'

test('report windows are inclusive and cross years and leap days', () => {
  assert.deepEqual(trailingDateRange(1, new Date(2024, 1, 29)), { start: '2024-02-29', end: '2024-02-29' })
  assert.deepEqual(trailingDateRange(3, new Date(2024, 2, 1)), { start: '2024-02-28', end: '2024-03-01' })
  assert.deepEqual(trailingDateRange(7, new Date(2025, 0, 2)), { start: '2024-12-27', end: '2025-01-02' })
  assert.throws(() => trailingDateRange(0), /at least one day/)
})

test('custom report ranges require real dates in chronological order', () => {
  assert.equal(validReportRange({ start: '2024-02-29', end: '2024-03-01' }), true)
  assert.equal(validReportRange({ start: '2023-02-29', end: '2024-03-01' }), false)
  assert.equal(validReportRange({ start: '2024-03-02', end: '2024-03-01' }), false)
  assert.equal(validReportRange({ start: '', end: '2024-03-01' }), false)
})

test('report pages include all rows and stop at an exact full final page', async () => {
  const source = [1, 2, 3, 4]
  const ranges: Array<[number, number]> = []
  const rows = await fetchReportPages(async (from, to) => {
    ranges.push([from, to])
    return { data: source.slice(from, to + 1), error: null, count: from === 0 ? source.length : null }
  }, 2)
  assert.deepEqual(rows, source)
  assert.deepEqual(ranges, [[0, 1], [2, 3]])
})

test('an exact count handles PostgREST caps smaller than the requested page', async () => {
  const source = [1, 2, 3, 4, 5]
  const ranges: Array<[number, number]> = []
  const rows = await fetchReportPages(async (from, to) => {
    ranges.push([from, to])
    return { data: source.slice(from, Math.min(to + 1, from + 2)), error: null, count: from === 0 ? source.length : null }
  }, 4)
  assert.deepEqual(rows, source)
  assert.deepEqual(ranges, [[0, 3], [2, 5], [4, 7]])
  await assert.rejects(fetchReportPages(async () => ({ data: [], error: null, count: 2 }), 4), /changed while loading/)
  await assert.rejects(fetchReportPages(async () => ({ data: [1], error: null, count: null }), 4), /verify that the report is complete/)
})

test('concurrent page overlap or count growth never yields a silently skewed total', async () => {
  await assert.rejects(fetchReportPages(async (from) => ({
    data: from === 0 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'b' }, { id: 'c' }],
    error: null,
    count: from === 0 ? 4 : null,
  }), 2), /changed while loading/)
  await assert.rejects(fetchReportPages(async (from) => ({
    data: from === 0 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'c' }, { id: 'd' }],
    error: null,
    count: from === 0 ? 3 : null,
  }), 2), /changed while loading/)
})

test('report pages stop on short pages and surface errors rather than partial totals', async () => {
  const calls: number[] = []
  const rows = await fetchReportPages(async (from) => {
    calls.push(from)
    return { data: from === 0 ? ['a', 'b'] : ['c'], error: null, count: from === 0 ? 3 : null }
  }, 2)
  assert.deepEqual(rows, ['a', 'b', 'c'])
  assert.deepEqual(calls, [0, 2])
  await assert.rejects(
    fetchReportPages(async (from) => ({
      data: from === 0 ? [1, 2] : null,
      error: from === 0 ? null : { message: 'network failed' },
      count: from === 0 ? 4 : null,
    }), 2),
    /network failed/,
  )
})
