export type FuelFill = {
  id: string
  vehicle_id: string | null
  date: string
  created_at: string
  odometer_km: number | null
  litres: number | null
  amount: number
}

export type ComputedFuelFill = FuelFill & {
  previous_odometer_km: number | null
  distance_km: number | null
  km_per_litre: number | null
  cost_per_km: number | null
}

export type VehicleFuelEfficiency = {
  vehicleId: string
  averageKmPerLitre: number | null
  averageCostPerKm: number | null
  lastFill: ComputedFuelFill
  fills: ComputedFuelFill[]
  flaggedFills: ComputedFuelFill[]
}

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function positiveNumber(value: number | null | undefined): value is number {
  return finiteNumber(value) && value > 0
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function chronological(a: FuelFill, b: FuelFill): number {
  return (
    a.date.localeCompare(b.date) ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * Calculate each fill against the latest earlier, valid odometer reading for
 * the same vehicle. Full-tank-to-full-tank behaviour is deliberately not
 * assumed: the current fill's litres are used exactly as requested.
 *
 * Invalid/missing readings do not produce misleading zeroes. A zero-litre
 * fill has no km/L, but its cost/km can still be calculated when distance is
 * known because cost/km depends on amount and distance, not litres.
 */
export function computeFuelFills(fills: FuelFill[]): ComputedFuelFill[] {
  const previousOdometers = new Map<string, number>()

  return [...fills].sort(chronological).map((fill) => {
    const vehicleId = fill.vehicle_id
    const previous = vehicleId ? previousOdometers.get(vehicleId) ?? null : null
    const odometer = finiteNumber(fill.odometer_km) && fill.odometer_km >= 0
      ? fill.odometer_km
      : null
    const distance = odometer !== null && previous !== null && odometer > previous
      ? odometer - previous
      : null

    const computed: ComputedFuelFill = {
      ...fill,
      previous_odometer_km: previous,
      distance_km: distance,
      km_per_litre:
        distance !== null && positiveNumber(fill.litres)
          ? distance / fill.litres
          : null,
      cost_per_km:
        distance !== null && finiteNumber(fill.amount) && fill.amount >= 0
          ? fill.amount / distance
          : null,
    }

    // Even a backwards reading is the previous reading for the next fill.
    // This fill gets no distance, while the next one is compared with the
    // actual latest odometer rather than silently rewriting history.
    if (vehicleId && odometer !== null) previousOdometers.set(vehicleId, odometer)
    return computed
  })
}

/** Per-vehicle averages and flags for fills more than 30% below average km/L. */
export function vehicleFuelEfficiency(fills: FuelFill[]): VehicleFuelEfficiency[] {
  const computed = computeFuelFills(fills).filter(
    (fill): fill is ComputedFuelFill & { vehicle_id: string } => Boolean(fill.vehicle_id),
  )
  const byVehicle = new Map<string, ComputedFuelFill[]>()
  for (const fill of computed) {
    const rows = byVehicle.get(fill.vehicle_id) || []
    rows.push(fill)
    byVehicle.set(fill.vehicle_id, rows)
  }

  return Array.from(byVehicle.entries()).map(([vehicleId, vehicleFills]) => {
    const kmPerLitreValues = vehicleFills
      .map((fill) => fill.km_per_litre)
      .filter((value): value is number => value !== null)
    const costPerKmValues = vehicleFills
      .map((fill) => fill.cost_per_km)
      .filter((value): value is number => value !== null)
    const averageKmPerLitre = average(kmPerLitreValues)
    const newestFirst = [...vehicleFills].reverse()

    return {
      vehicleId,
      averageKmPerLitre,
      averageCostPerKm: average(costPerKmValues),
      lastFill: vehicleFills[vehicleFills.length - 1],
      fills: newestFirst,
      flaggedFills: newestFirst.filter(
        (fill) =>
          fill.km_per_litre !== null &&
          averageKmPerLitre !== null &&
          fill.km_per_litre < averageKmPerLitre * 0.7,
      ),
    }
  })
}

export function fuelTotalFromPrice(litres: number, pricePerLitre: number): number | null {
  if (!positiveNumber(litres) || !positiveNumber(pricePerLitre)) return null
  return Math.round(litres * pricePerLitre * 100) / 100
}

export function fuelPriceFromTotal(litres: number, amount: number): number | null {
  if (!positiveNumber(litres) || !finiteNumber(amount) || amount < 0) return null
  return Math.round((amount / litres) * 100) / 100
}

export function validFuelPhotoRetentionDays(value: number): boolean {
  return Number.isInteger(value) && value >= 30 && value <= 365
}
