/** Cursor for trip_date DESC, created_at DESC NULLS FIRST, id DESC. */
export type TripCursor = { trip_date: string; created_at: string | null; id: string };

export const TRIP_PAGE_SIZE = 50;
export const TRIP_LIST_COLUMNS = 'id, vehicle_id, driver_id, trip_date, created_at, distance_km, earnings, expenses, start_location, end_location, notes, recorded_by, vehicles(registration_number), drivers(full_name, user_id)';
export const TRIP_TOTALS_COLUMNS = 'id, earnings, expenses';

/**
 * Keyset predicate for the exact list order. trip_date is the primary sort key,
 * so a backdated trip with a newer created_at must not pull later-dated rows
 * back into the next page. NULL created_at sorts first within its date.
 */
export function tripCursorFilter(cursor: TripCursor): string {
  const earlierDate = `trip_date.lt.${cursor.trip_date}`;
  const sameDate = `trip_date.eq.${cursor.trip_date}`;
  if (cursor.created_at === null) {
    return [
      earlierDate,
      `and(${sameDate},created_at.is.null,id.lt.${cursor.id})`,
      `and(${sameDate},created_at.not.is.null)`,
    ].join(',');
  }
  return [
    earlierDate,
    `and(${sameDate},created_at.lt.${cursor.created_at})`,
    `and(${sameDate},created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
  ].join(',');
}

/** The look-ahead row tells us whether another page exists without an exact count. */
export function splitTripPage<T>(rows: T[]): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, TRIP_PAGE_SIZE), hasMore: rows.length > TRIP_PAGE_SIZE };
}

/** Concurrent inserts/edits must not duplicate a trip in the visible list. */
export function appendUniqueTrips<T extends { id: string }>(existing: T[], page: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  return [...existing, ...page.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  })];
}

export type TripTotals = { earnings: number; expenses: number; profit: number; count: number };

/** Totals cover the whole tenant/driver scope, independently of the visible page. */
export function sumTripTotals(rows: Array<{ earnings: number | null; expenses: number | null }>): TripTotals {
  let earnings = 0;
  let expenses = 0;
  for (const row of rows) {
    earnings += row.earnings || 0;
    expenses += row.expenses || 0;
  }
  return { earnings, expenses, profit: earnings - expenses, count: rows.length };
}
