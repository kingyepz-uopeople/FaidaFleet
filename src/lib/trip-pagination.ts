/** Cursor for trip_date DESC, created_at DESC, id DESC (NULL timestamps first). */
export type TripCursor = { trip_date: string; created_at: string | null; id: string };

export const TRIP_PAGE_SIZE = 50;
export const TRIP_LIST_COLUMNS = 'id, vehicle_id, driver_id, trip_date, created_at, distance_km, earnings, expenses, start_location, end_location, notes, recorded_by, vehicles(registration_number), drivers(full_name, user_id)';

/** Continue strictly after the last visible trip; values come from database rows. */
export function tripCursorFilter(cursor: TripCursor): string {
  const sameDate = `trip_date.eq.${cursor.trip_date},id.lt.${cursor.id}`;
  if (cursor.created_at === null) {
    return [
      `and(created_at.is.null,trip_date.lt.${cursor.trip_date})`,
      `and(created_at.is.null,${sameDate})`,
      'created_at.not.is.null',
    ].join(',');
  }
  return [
    `created_at.lt.${cursor.created_at}`,
    `and(created_at.eq.${cursor.created_at},trip_date.lt.${cursor.trip_date})`,
    `and(created_at.eq.${cursor.created_at},${sameDate})`,
  ].join(',');
}

/** The look-ahead row tells us whether another page exists without an exact count. */
export function splitTripPage<T>(rows: T[]): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, TRIP_PAGE_SIZE), hasMore: rows.length > TRIP_PAGE_SIZE };
}

/** Concurrent inserts/edits must not duplicate a trip or its loaded-page totals. */
export function appendUniqueTrips<T extends { id: string }>(existing: T[], page: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  return [...existing, ...page.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  })];
}
