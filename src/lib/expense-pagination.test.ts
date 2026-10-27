import assert from 'node:assert/strict'
import test from 'node:test'
import { appendUniqueExpenses, expenseCursorFilter, splitExpensePage } from './expense-pagination'

test('the expense look-ahead row is not counted and signals another page', () => {
  assert.deepEqual(splitExpensePage([1, 2, 3], 2), { rows: [1, 2], hasMore: true })
  assert.deepEqual(splitExpensePage([1, 2], 2), { rows: [1, 2], hasMore: false })
  assert.deepEqual(splitExpensePage([], 2), { rows: [], hasMore: false })
  // Even if the server's response cap is below our requested page size, the
  // exact count keeps the load-more control available.
  assert.deepEqual(splitExpensePage([1], 2, 5), { rows: [1], hasMore: true })
})

test('expense cursors preserve descending timestamp/date/id order, including null timestamps', () => {
  const date = '2026-10-27'
  const id = 'd85d7b67-3a35-411d-a09f-f744fdd344aa'
  assert.equal(expenseCursorFilter({ created_at: null, date, id }),
    `and(created_at.is.null,date.lt.${date}),and(created_at.is.null,date.eq.${date},id.lt.${id}),created_at.not.is.null`)
  const time = '2026-10-27T09:00:00+00:00'
  assert.equal(expenseCursorFilter({ created_at: time, date, id }),
    `created_at.lt.${time},and(created_at.eq.${time},date.lt.${date}),and(created_at.eq.${time},date.eq.${date},id.lt.${id})`)
})

test('overlapping pages never double-count an expense', () => {
  assert.deepEqual(appendUniqueExpenses([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }]),
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }])
})
