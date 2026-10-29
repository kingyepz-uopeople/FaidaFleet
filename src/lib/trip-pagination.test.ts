import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueTrips, splitTripPage, tripCursorFilter, TRIP_PAGE_SIZE } from './trip-pagination';

test('trip pages show at most 50 rows and keep the look-ahead row out of totals', () => {
  const rows = Array.from({ length: TRIP_PAGE_SIZE + 1 }, (_, id) => ({ id }));
  const page = splitTripPage(rows);
  assert.equal(page.rows.length, TRIP_PAGE_SIZE);
  assert.equal(page.hasMore, true);
  assert.equal(page.rows.at(-1)?.id, 49);
  assert.deepEqual(splitTripPage(rows.slice(0, TRIP_PAGE_SIZE)), { rows: rows.slice(0, TRIP_PAGE_SIZE), hasMore: false });
  assert.deepEqual(splitTripPage([]), { rows: [], hasMore: false });
});

test('trip cursors preserve date/timestamp/id order, including null timestamps', () => {
  const trip_date = '2026-10-29';
  const id = 'd85d7b67-3a35-411d-a09f-f744fdd344aa';
  assert.equal(tripCursorFilter({ trip_date, created_at: null, id }),
    `and(created_at.is.null,trip_date.lt.${trip_date}),and(created_at.is.null,trip_date.eq.${trip_date},id.lt.${id}),created_at.not.is.null`);
  const created_at = '2026-10-29T09:00:00+00:00';
  assert.equal(tripCursorFilter({ trip_date, created_at, id }),
    `created_at.lt.${created_at},and(created_at.eq.${created_at},trip_date.lt.${trip_date}),and(created_at.eq.${created_at},trip_date.eq.${trip_date},id.lt.${id})`);
});

test('overlapping trip pages never double-count a record', () => {
  assert.deepEqual(appendUniqueTrips([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }]),
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});
