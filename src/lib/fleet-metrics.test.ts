import assert from 'node:assert/strict'
import test from 'node:test'
import {
  daysUntil,
  formatDateOnly,
  isDateBeforeToday,
  isExpiringWithin,
  weekdayShort,
} from './dates'
import {
  buildWeeklySeries,
  collectionStatus,
  complianceIssues,
  driverLeaderboard,
  groupFinancials,
  profitBreakdown,
  reconciliationStats,
  sumAmounts,
  vehicleComplianceStatus,
} from './fleet-metrics'

const today = new Date(2026, 8, 29, 18, 30, 0)

test('calendar dates do not expire on the expiry day', () => {
  assert.equal(isDateBeforeToday('2026-09-29', today), false)
  assert.equal(isDateBeforeToday('2026-09-28', today), true)
  assert.equal(daysUntil('2026-09-29', today), 0)
  assert.equal(isExpiringWithin('2026-10-29', 30, today), true)
  assert.equal(isExpiringWithin('2026-10-30', 30, today), false)
  assert.equal(weekdayShort('2026-09-29'), 'Tue')
  assert.equal(formatDateOnly('2026-09-29'), 'Sep 29, 2026')
})

test('weekly totals use every matching date row, including amounts stored as text', () => {
  const series = buildWeeklySeries(
    [
      { date: '2026-09-22', amount: 100 },
      { date: '2026-09-29', amount: '250.50' },
      { date: '2026-09-29', amount: 50 },
      { date: '2026-09-29T18:00:00', amount: null },
    ],
    [{ date: '2026-09-29', amount: 'not-a-number' }],
    today
  )

  assert.equal(series.length, 7)
  assert.equal(series[0].date, '2026-09-23')
  assert.equal(series.at(-1)?.collections, 300.5)
  assert.equal(series.at(-1)?.expenses, 0)
  assert.equal(sumAmounts([{ amount: '10' }, { amount: null }, { amount: 'bad' }]), 10)
})

test('cash collections are recorded, and only M-Pesa or Pochi stay pending', () => {
  const stats = reconciliationStats([
    { date: '2026-09-29', amount: 100, payment_method: 'cash', reconciled: false },
    { date: '2026-09-29', amount: 200, payment_method: 'mpesa', reconciled: true },
    { date: '2026-09-29', amount: 300, payment_method: 'pochi', reconciled: false },
  ])

  assert.deepEqual(stats, { electronicCount: 2, reconciled: 1, pending: 1, rate: 50 })
  assert.equal(collectionStatus({ payment_method: 'cash', reconciled: false }), 'Recorded')
  assert.equal(collectionStatus({ payment_method: 'mpesa', reconciled: false }), 'Pending')
  assert.equal(collectionStatus({ payment_method: 'mpesa', reconciled: true }), 'Reconciled')
})

test('compliance treats today as valid and yesterday as expired', () => {
  const vehicles = [
    {
      id: '1',
      registration_number: 'KCA 123A',
      insurance_expiry: '2026-09-29',
      mot_expiry: '2026-09-28',
    },
    {
      id: '2',
      registration_number: 'KDB 456B',
      insurance_expiry: '2026-10-20',
      mot_expiry: null,
    },
  ]

  assert.deepEqual(complianceIssues(vehicles, today), [
    { id: '1', registration: 'KCA 123A', label: 'Insurance expires soon', severity: 'warning' },
    { id: '1', registration: 'KCA 123A', label: 'MOT expired', severity: 'expired' },
    { id: '2', registration: 'KDB 456B', label: 'Insurance expires soon', severity: 'warning' },
  ])
  assert.equal(
    vehicleComplianceStatus({ insurance_expiry: '2026-09-29', mot_expiry: null }, today),
    'Warning'
  )
  assert.equal(
    vehicleComplianceStatus({ insurance_expiry: '2026-09-28', mot_expiry: null }, today),
    'Expired'
  )
})

test('financial grouping ignores invalid amounts and omits negative profit from the pie', () => {
  const report = groupFinancials(
    [
      { date: '2026-09-01', amount: 1000 },
      { date: '2026-09-01', amount: 'bad' },
    ],
    [{ date: '2026-09-01', amount: 400 }]
  )

  assert.equal(report.totalRevenue, 1000)
  assert.equal(report.totalExpenses, 400)
  assert.equal(report.totalProfit, 600)
  assert.equal(report.profitMargin, 60)
  assert.deepEqual(profitBreakdown(-100, 400), [{ name: 'Expenses', value: 400 }])
  assert.deepEqual(profitBreakdown(0, 0), [])
})

test('driver profit subtracts trip costs instead of leaving expenses at zero', () => {
  const board = driverLeaderboard(
    [
      { id: 'a', full_name: 'Amina' },
      { id: 'b', full_name: 'Brian' },
    ],
    [
      { driver_id: 'a', amount: 5000 },
      { driver_id: 'a', amount: 1000 },
      { driver_id: 'b', amount: 3000 },
    ],
    [
      { driver_id: 'a', expenses: 2000 },
      { driver_id: 'a', expenses: 500 },
      { driver_id: 'b', expenses: 100 },
    ]
  )

  assert.deepEqual(
    board.map((driver) => ({
      name: driver.driverName,
      collections: driver.collections,
      expenses: driver.expenses,
      profit: driver.profit,
      trips: driver.trips,
    })),
    [
      { name: 'Amina', collections: 6000, expenses: 2500, profit: 3500, trips: 2 },
      { name: 'Brian', collections: 3000, expenses: 100, profit: 2900, trips: 1 },
    ]
  )
})
