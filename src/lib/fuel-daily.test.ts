import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDailyFuelMetrics, mergeFuelFills, type FullTankFill } from './fuel-daily'

function fill(id: string, date: string, litres: number, amount = litres * 180, vehicle_id = 'van-1'): FullTankFill {
  return { id, vehicle_id, date, created_at: `${date}T18:00:00.000Z`, litres, amount, full_tank: true }
}

test('spreads litres and fill cost over the completed gap and sums trip distance by day', () => {
  const metrics = calculateDailyFuelMetrics(
    [fill('a', '2026-10-01', 20), fill('b', '2026-10-04', 30, 6000)],
    [
      { vehicle_id: 'van-1', trip_date: '2026-10-02', distance_km: 80 },
      { vehicle_id: 'van-1', trip_date: '2026-10-02', distance_km: 20 },
      { vehicle_id: 'van-1', trip_date: '2026-10-04', distance_km: 150 },
      { vehicle_id: 'van-1', trip_date: '2026-10-03', distance_km: null },
    ],
    { start: '2026-10-02', end: '2026-10-04' },
  )

  assert.deepEqual(metrics.map(({ date }) => date), ['2026-10-04', '2026-10-03', '2026-10-02'])
  assert.deepEqual(metrics[2], {
    vehicleId: 'van-1', date: '2026-10-02', km: 100, litres: 10,
    kmPerLitre: 10, costPerKm: 20, anomaly: false,
  })
  assert.equal(metrics[1].kmPerLitre, null)
  assert.equal(metrics[0].costPerKm, 13.333333333333334)
})

test('does not calculate partial intervals, non-full fills, or the first fill', () => {
  const metrics = calculateDailyFuelMetrics(
    [fill('a', '2026-10-01', 25), { ...fill('b', '2026-10-02', 10), full_tank: false }],
    [{ vehicle_id: 'van-1', trip_date: '2026-10-01', distance_km: 99 }],
    { start: '2026-10-01', end: '2026-10-02' },
  )
  assert.deepEqual(metrics, [])
})

test('same-day full tank entries combine and tenant/vehicle data stays isolated by vehicle', () => {
  const metrics = calculateDailyFuelMetrics(
    [fill('a', '2026-10-01', 10), fill('b', '2026-10-01', 5), fill('c', '2026-10-02', 15)],
    [
      { vehicle_id: 'van-1', trip_date: '2026-10-02', distance_km: 60 },
      { vehicle_id: 'van-2', trip_date: '2026-10-02', distance_km: 900 },
    ],
    { start: '2026-10-02', end: '2026-10-02' },
  )
  assert.equal(metrics.length, 1)
  assert.equal(metrics[0].litres, 15)
  assert.equal(metrics[0].km, 60)
  assert.equal(metrics[0].kmPerLitre, 4)
})

test('anomalies are measured against the vehicle median only after five valid points', () => {
  const dates = ['01', '02', '03', '04', '05', '06', '07']
  const fills = dates.map((day, index) => fill(String(index), `2026-10-${day}`, 10))
  const trips = dates.slice(1).map((day, index) => ({
    vehicle_id: 'van-1', trip_date: `2026-10-${day}`,
    distance_km: index === 5 ? 20 : 100,
  }))
  const metrics = calculateDailyFuelMetrics(fills, trips, { start: '2026-10-02', end: '2026-10-07' })
  assert.equal(metrics.filter((point) => point.kmPerLitre !== null).length, 6)
  assert.equal(metrics.find((point) => point.date === '2026-10-07')?.anomaly, true)

  const short = calculateDailyFuelMetrics(fills.slice(0, 5), trips.slice(0, 3), { start: '2026-10-02', end: '2026-10-05' })
  assert.equal(short.some((point) => point.anomaly), false)
})

test('an older preceding anchor preserves the first interval when the recent lookback is bounded', () => {
  const anchor = fill('old', '2026-01-01', 99)
  const recent = [fill('a', '2026-09-01', 20), fill('b', '2026-10-04', 30, 6000)]
  const trips = [{ vehicle_id: 'van-1', trip_date: '2026-10-02', distance_km: 100 }]
  const range = { start: '2026-10-02', end: '2026-10-04' }
  const full = calculateDailyFuelMetrics([anchor, ...recent], trips, range)
  const bounded = calculateDailyFuelMetrics(mergeFuelFills(recent, [anchor]), trips, range)
  assert.deepEqual(bounded, full)
  assert.equal(mergeFuelFills(recent, [anchor, recent[0]]).length, 3)
})
