export type FullTankFill = {
  id: string
  vehicle_id: string | null
  date: string
  created_at?: string | null
  litres: number | null
  amount: number
  full_tank: boolean
}

export type DailyTripDistance = {
  vehicle_id: string
  trip_date: string
  distance_km: number | null
}

export type DailyFuelMetric = {
  vehicleId: string
  date: string
  km: number
  litres: number
  kmPerLitre: number | null
  costPerKm: number | null
  anomaly: boolean
}

function dateOrdinal(value: string): number {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function dateKey(ordinal: number): string {
  return new Date(ordinal * 86_400_000).toISOString().slice(0, 10)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Spread each full-tank interval's fuel and trip distance evenly over the
 * calendar days since the preceding full-tank fill (exclusive) through the
 * current fill date (inclusive). Only days covered by a completed fill
 * interval are returned, preventing partial first intervals from looking like
 * complete consumption data. Inputs should be tenant-scoped by the caller.
 */
export function calculateDailyFuelMetrics(
  fills: FullTankFill[],
  trips: DailyTripDistance[],
  range: { start: string; end: string },
): DailyFuelMetric[] {
  const from = dateOrdinal(range.start)
  const through = dateOrdinal(range.end)
  if (!Number.isFinite(from) || !Number.isFinite(through) || from > through) return []

  const fillsByVehicle = new Map<string, FullTankFill[]>()
  for (const fill of fills) {
    if (!fill.full_tank || !fill.vehicle_id || !Number.isFinite(fill.litres) || (fill.litres ?? 0) <= 0) continue
    const rows = fillsByVehicle.get(fill.vehicle_id) || []
    rows.push(fill)
    fillsByVehicle.set(fill.vehicle_id, rows)
  }

  const tripsByVehicleDay = new Map<string, number>()
  for (const trip of trips) {
    if (!Number.isFinite(trip.distance_km) || (trip.distance_km ?? 0) < 0) continue
    const key = `${trip.vehicle_id}:${trip.trip_date.slice(0, 10)}`
    tripsByVehicleDay.set(key, (tripsByVehicleDay.get(key) || 0) + (trip.distance_km || 0))
  }

  const points: DailyFuelMetric[] = []
  for (const [vehicleId, vehicleFills] of fillsByVehicle) {
    vehicleFills.sort((a, b) => a.date.localeCompare(b.date)
      || (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id))

    // Multiple full-tank transactions on one calendar day form one endpoint.
    const dailyFills: FullTankFill[] = []
    for (const fill of vehicleFills) {
      const prior = dailyFills[dailyFills.length - 1]
      if (prior?.date === fill.date) {
        dailyFills[dailyFills.length - 1] = {
          ...fill,
          id: `${prior.id}:${fill.id}`,
          litres: (prior.litres || 0) + (fill.litres || 0),
          amount: prior.amount + fill.amount,
        }
      } else dailyFills.push(fill)
    }

    for (let index = 1; index < dailyFills.length; index += 1) {
      const previous = dateOrdinal(dailyFills[index - 1].date)
      const current = dailyFills[index]
      const endpoint = dateOrdinal(current.date)
      const span = endpoint - previous
      if (span < 1) continue
      const litresPerDay = (current.litres || 0) / span
      const costPerDay = current.amount / span

      for (let day = previous + 1; day <= endpoint; day += 1) {
        if (day < from || day > through) continue
        const date = dateKey(day)
        const km = tripsByVehicleDay.get(`${vehicleId}:${date}`) || 0
        points.push({
          vehicleId,
          date,
          km,
          litres: litresPerDay,
          kmPerLitre: km > 0 && litresPerDay > 0 ? km / litresPerDay : null,
          costPerKm: km > 0 ? costPerDay / km : null,
          anomaly: false,
        })
      }
    }
  }

  const efficienciesByVehicle = new Map<string, number[]>()
  for (const point of points) {
    if (point.kmPerLitre === null) continue
    const values = efficienciesByVehicle.get(point.vehicleId) || []
    values.push(point.kmPerLitre)
    efficienciesByVehicle.set(point.vehicleId, values)
  }

  for (const point of points) {
    const values = efficienciesByVehicle.get(point.vehicleId) || []
    if (point.kmPerLitre === null || values.length < 5) continue
    const baseline = median(values)
    point.anomaly = baseline > 0 && Math.abs(point.kmPerLitre - baseline) / baseline > 0.3
  }

  return points.sort((a, b) => b.date.localeCompare(a.date) || a.vehicleId.localeCompare(b.vehicleId))
}
