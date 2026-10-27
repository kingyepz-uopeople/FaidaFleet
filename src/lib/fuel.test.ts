import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeFuelFills,
  fuelPriceFromTotal,
  fuelTotalFromPrice,
  validFuelPhotoRetentionDays,
  vehicleFuelEfficiency,
  type FuelFill,
} from './fuel'

function fill(id: string, values: Partial<FuelFill> = {}): FuelFill {
  return {
    id,
    vehicle_id: 'vehicle-1',
    date: `2026-10-${id.padStart(2, '0')}`,
    created_at: `2026-10-${id.padStart(2, '0')}T08:00:00.000Z`,
    odometer_km: 1000,
    litres: 20,
    amount: 3600,
    ...values,
  }
}

test('the first fill has no distance, km/L or cost/km', () => {
  const [result] = computeFuelFills([fill('1')])
  assert.equal(result.previous_odometer_km, null)
  assert.equal(result.distance_km, null)
  assert.equal(result.km_per_litre, null)
  assert.equal(result.cost_per_km, null)
})

test('a later fill uses the previous odometer for the same vehicle only', () => {
  const result = computeFuelFills([
    fill('2', { odometer_km: 1250, litres: 25, amount: 5000 }),
    fill('1', { odometer_km: 1000 }),
    fill('3', { vehicle_id: 'vehicle-2', odometer_km: 800 }),
  ])

  assert.equal(result[1].distance_km, 250)
  assert.equal(result[1].km_per_litre, 10)
  assert.equal(result[1].cost_per_km, 20)
  assert.equal(result[2].distance_km, null)
})

test('nullable creation timestamps sort last within the same date', () => {
  const result = computeFuelFills([
    fill('2', { date: '2026-10-01', created_at: null, odometer_km: 1200 }),
    fill('1', { date: '2026-10-01', odometer_km: 1000 }),
  ])
  assert.deepEqual(result.map((entry) => entry.id), ['1', '2'])
  assert.equal(result[1].distance_km, 200)
})

test('a backwards odometer does not produce negative efficiency', () => {
  const result = computeFuelFills([
    fill('1', { odometer_km: 1200 }),
    fill('2', { odometer_km: 1100 }),
    fill('3', { odometer_km: 1400, litres: 30 }),
  ])

  assert.equal(result[1].distance_km, null)
  assert.equal(result[1].km_per_litre, null)
  assert.equal(result[1].cost_per_km, null)
  assert.equal(result[2].previous_odometer_km, 1100)
  assert.equal(result[2].distance_km, 300)
})

test('zero litres returns null km/L without inventing a zero cost/km', () => {
  const result = computeFuelFills([
    fill('1', { odometer_km: 1000 }),
    fill('2', { odometer_km: 1100, litres: 0, amount: 500 }),
  ])

  assert.equal(result[1].km_per_litre, null)
  assert.equal(result[1].cost_per_km, 5)
})

test('missing odometer readings are skipped until a valid earlier reading exists', () => {
  const result = computeFuelFills([
    fill('1', { odometer_km: 1000 }),
    fill('2', { odometer_km: null }),
    fill('3', { odometer_km: 1150, litres: 15 }),
  ])

  assert.equal(result[2].previous_odometer_km, 1000)
  assert.equal(result[2].km_per_litre, 10)
})

test('vehicle summaries average valid fills and flag fills over 30% worse', () => {
  const [summary] = vehicleFuelEfficiency([
    fill('1', { odometer_km: 0 }),
    fill('2', { odometer_km: 100, litres: 10, amount: 1000 }),
    fill('3', { odometer_km: 200, litres: 10, amount: 1000 }),
    fill('4', { odometer_km: 250, litres: 20, amount: 2000 }),
  ])

  assert.ok(summary)
  assert.equal(summary.averageKmPerLitre, 22.5 / 3)
  assert.equal(summary.averageCostPerKm, 20)
  assert.equal(summary.lastFill.id, '4')
  assert.deepEqual(summary.flaggedFills.map((entry) => entry.id), ['4'])
  assert.equal(summary.fills[0].id, '4')
})

test('fuel amount helpers compute and round the companion field', () => {
  assert.equal(fuelTotalFromPrice(12.5, 179.95), 2249.38)
  assert.equal(fuelPriceFromTotal(12.5, 2249.38), 179.95)
  assert.equal(fuelTotalFromPrice(0, 180), null)
  assert.equal(fuelPriceFromTotal(0, 1000), null)
})

test('fuel photo retention accepts only whole days from 30 through 365', () => {
  assert.equal(validFuelPhotoRetentionDays(30), true)
  assert.equal(validFuelPhotoRetentionDays(90), true)
  assert.equal(validFuelPhotoRetentionDays(365), true)
  assert.equal(validFuelPhotoRetentionDays(29), false)
  assert.equal(validFuelPhotoRetentionDays(366), false)
  assert.equal(validFuelPhotoRetentionDays(90.5), false)
})
