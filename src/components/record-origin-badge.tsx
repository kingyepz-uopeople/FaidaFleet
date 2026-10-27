import { Badge } from '@/components/ui/badge'
import { recordOrigin } from '@/lib/record-origin'

export function RecordOriginBadge({
  recordedBy,
  driverUserId,
}: {
  recordedBy: string | null
  driverUserId: string | null | undefined
}) {
  const label = recordOrigin(recordedBy, driverUserId)
  return label ? <Badge variant="outline">{label}</Badge> : null
}
