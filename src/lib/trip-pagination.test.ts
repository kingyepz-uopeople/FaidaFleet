import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueTrips, splitTripPage, sumTripTotals, TRIP_PAGE_SIZE, tripCursorFilter, type TripCursor } from './trip-pagination';
import { fetchReportPages } from './report-range';

test('trip pages use a look-ahead row instead of an exact count', () => {
  const rows = Array.from({ length: TRIP_PAGE_SIZE + 1 }, (_, i) => ({ id: String(i) }));
  assert.deepEqual(splitTripPage(rows), { rows: rows.slice(0, TRIP_PAGE_SIZE), hasMore: true });
  assert.deepEqual(splitTripPage(rows.slice(0, TRIP_PAGE_SIZE)), { rows: rows.slice(0, TRIP_PAGE_SIZE), hasMore: false });
  assert.deepEqual(splitTripPage([]), { rows: [], hasMore: false });
});

/** Evaluate the PostgREST-style filter the page sends, over real sample rows. */
function matchesFilter(row: TripCursor, filter: string): boolean {
  const splitTopLevel = (value: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] === '(') depth += 1;
      else if (value[i] === ')') depth -= 1;
      else if (value[i] === ',' && depth === 0) {
        parts.push(value.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(value.slice(start));
    return parts;
  };
  const matches = (expr: string): boolean => {
    if (expr.startsWith('and(') && expr.endsWith(')')) return splitTopLevel(expr.slice(4, -1)).every(matches);
    if (expr.startsWith('or(') && expr.endsWith(')')) return splitTopLevel(expr.slice(3, -1)).some(matches);
    const [field, op, ...rest] = expr.split('.');
    const value = rest.join('.');
    const actual = row[field as keyof TripCursor];
    if (op === 'is') return value === 'null' && actual === null;
    if (op === 'not') return value === 'is.null' && actual !== null;
    if (actual === null) return false;
    if (op === 'lt') return actual < value;
    if (op === 'eq') return actual === value;
    throw new Error(`Unsupported filter: ${expr}`);
  };
  return splitTopLevel(filter).some(matches);
}

function compareTrips(a: TripCursor, b: TripCursor): number {
  if (a.trip_date !== b.trip_date) return a.trip_date < b.trip_date ? 1 : -1;
  if (a.created_at === null && b.created_at !== null) return -1;
  if (a.created_at !== null && b.created_at === null) return 1;
  if (a.created_at !== b.created_at) return (a.created_at || '') < (b.created_at || '') ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

test('trip cursor pages through backdated trips, date ties and null created_at exactly once in order', () => {
  const rows: TripCursor[] = [
    // Backdated: older trip_date but newer created_at than later-dated trips.
    { id: 'i', trip_date: '2026-10-01', created_at: '2026-10-29T09:00:00Z' },
    { id: 'h', trip_date: '2026-10-28', created_at: '2026-10-28T09:00:00Z' },
    // Same date, null created_at sorts first, then id DESC.
    { id: 'g', trip_date: '2026-10-28', created_at: null },
    { id: 'f', trip_date: '2026-10-28', created_at: null },
    // Same date and same created_at, id breaks the tie.
    { id: 'e', trip_date: '2026-10-28', created_at: '2026-10-28T08:00:00Z' },
    { id: 'd', trip_date: '2026-10-28', created_at: '2026-10-28T08:00:00Z' },
    { id: 'c', trip_date: '2026-10-27', created_at: '2026-10-29T10:00:00Z' },
    { id: 'b', trip_date: '2026-10-27', created_at: null },
    { id: 'a', trip_date: '2026-10-26', created_at: '2026-10-26T08:00:00Z' },
  ];
  const expected = [...rows].sort(compareTrips).map((row) => row.id);
  for (const pageSize of [1, 2, 3, 5, 50]) {
    const ordered = [...rows].sort(compareTrips);
    const seen: string[] = [];
    let cursor: TripCursor | null = null;
    for (let guard = 0; guard < rows.length + 1; guard += 1) {
      const activeCursor: TripCursor | null = cursor;
      const remaining: TripCursor[] = activeCursor ? ordered.filter((row) => matchesFilter(row, tripCursorFilter(activeCursor))) : ordered;
      const page: TripCursor[] = remaining.slice(0, pageSize);
      seen.push(...page.map((row) => row.id));
      if (page.length < pageSize) break;
      cursor = page[page.length - 1];
    }
    assert.deepEqual(seen, expected, `page size ${pageSize}`);
    assert.equal(new Set(seen).size, rows.length, `page size ${pageSize} must not repeat trips`);
  }
});

test('appended trip pages do not duplicate concurrent inserts or edits', () => {
  assert.deepEqual(appendUniqueTrips([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }]), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('trip totals sum the whole scope, including rows beyond the 1,000-row server cap', async () => {
  const all = Array.from({ length: 1250 }, (_, i) => ({ id: String(i).padStart(4, '0'), earnings: i % 3 === 0 ? null : 10, expenses: i % 4 === 0 ? null : 4 }));
  const pages = await fetchReportPages(async (from, to, withCount) => ({
    data: all.slice(from, to + 1),
    error: null,
    count: withCount ? all.length : null,
  }), 500);
  const totals = sumTripTotals(pages);
  const expectedEarnings = all.reduce((sum, row) => sum + (row.earnings || 0), 0);
  const expectedExpenses = all.reduce((sum, row) => sum + (row.expenses || 0), 0);
  assert.equal(totals.count, 1250);
  assert.equal(totals.earnings, expectedEarnings);
  assert.equal(totals.expenses, expectedExpenses);
  assert.equal(totals.profit, expectedEarnings - expectedExpenses);
  assert.deepEqual(sumTripTotals([]), { earnings: 0, expenses: 0, profit: 0, count: 0 });
});
