export type RecordOrigin = 'Entered by owner' | 'Entered by driver' | null

/** Older records have no recorded_by and deliberately receive no label. */
export function recordOrigin(
  recordedBy: string | null | undefined,
  driverUserId: string | null | undefined,
): RecordOrigin {
  if (!recordedBy) return null
  return recordedBy === driverUserId ? 'Entered by driver' : 'Entered by owner'
}
