import { isDateBeforeToday, isExpiringWithin, lastNDateKeys, weekdayShort } from './dates'

export type MoneyRow = {
  date: string | null
  amount: number | string | null
}

export type CollectionRow = MoneyRow & {
  payment_method: string | null
  reconciled: boolean | null
}

export function amountOf(value: number | string | null | undefined): number {
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function sumAmounts(rows: { amount: number | string | null | undefined }[]): number {
  return rows.reduce((sum, row) => sum + amountOf(row.amount), 0)
}

export function buildWeeklySeries(
  collections: MoneyRow[],
  expenses: MoneyRow[],
  today = new Date()
) {
  return lastNDateKeys(7, today).map((date) => ({
    date,
    day: weekdayShort(date),
    collections: sumAmounts(collections.filter((row) => row.date?.slice(0, 10) === date)),
    expenses: sumAmounts(expenses.filter((row) => row.date?.slice(0, 10) === date)),
  }))
}

export function reconciliationStats(collections: CollectionRow[]) {
  const electronic = collections.filter(
    (row) => row.payment_method === 'mpesa' || row.payment_method === 'pochi'
  )
  const reconciled = electronic.filter((row) => row.reconciled).length
  return {
    electronicCount: electronic.length,
    reconciled,
    pending: electronic.length - reconciled,
    rate: electronic.length > 0 ? Math.round((reconciled / electronic.length) * 100) : 0,
  }
}

export function collectionStatus(row: {
  payment_method: string | null
  reconciled: boolean | null
}): 'Recorded' | 'Reconciled' | 'Pending' {
  if (row.payment_method === 'cash') return 'Recorded'
  return row.reconciled ? 'Reconciled' : 'Pending'
}

export type ComplianceVehicle = {
  id: string
  registration_number: string
  insurance_expiry: string | null
  mot_expiry: string | null
}

export type ComplianceIssue = {
  id: string
  registration: string
  label: string
  severity: 'expired' | 'warning'
}

export function complianceIssues(vehicles: ComplianceVehicle[], today = new Date()): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  for (const vehicle of vehicles) {
    const checks: [string, string | null][] = [
      ['Insurance', vehicle.insurance_expiry],
      ['MOT', vehicle.mot_expiry],
    ]
    for (const [name, value] of checks) {
      if (!value) continue
      if (isDateBeforeToday(value, today)) {
        issues.push({
          id: vehicle.id,
          registration: vehicle.registration_number,
          label: `${name} expired`,
          severity: 'expired',
        })
      } else if (isExpiringWithin(value, 30, today)) {
        issues.push({
          id: vehicle.id,
          registration: vehicle.registration_number,
          label: `${name} expires soon`,
          severity: 'warning',
        })
      }
    }
  }
  return issues
}

export function vehicleComplianceStatus(
  vehicle: { insurance_expiry: string | null; mot_expiry: string | null },
  today = new Date()
): 'Active' | 'Warning' | 'Expired' {
  const issues = complianceIssues(
    [{ id: 'vehicle', registration_number: '', ...vehicle }],
    today
  )
  if (issues.some((issue) => issue.severity === 'expired')) return 'Expired'
  if (issues.length > 0) return 'Warning'
  return 'Active'
}

export type FinancialPoint = {
  date: string
  revenue: number
  expenses: number
  profit: number
}

export function groupFinancials(collections: MoneyRow[], expenses: MoneyRow[]) {
  const dateMap = new Map<string, { revenue: number; expenses: number }>()
  const add = (date: string | null, field: 'revenue' | 'expenses', amount: number | string | null) => {
    const key = date?.slice(0, 10)
    if (!key) return
    const entry = dateMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry[field] += amountOf(amount)
    dateMap.set(key, entry)
  }

  collections.forEach((row) => add(row.date, 'revenue', row.amount))
  expenses.forEach((row) => add(row.date, 'expenses', row.amount))

  const series: FinancialPoint[] = Array.from(dateMap.entries())
    .map(([date, entry]) => ({
      date,
      revenue: entry.revenue,
      expenses: entry.expenses,
      profit: entry.revenue - entry.expenses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalRevenue = series.reduce((sum, point) => sum + point.revenue, 0)
  const totalExpenses = series.reduce((sum, point) => sum + point.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses

  return {
    series,
    totalRevenue,
    totalExpenses,
    totalProfit,
    profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
  }
}

export function profitBreakdown(totalProfit: number, totalExpenses: number) {
  return [
    totalProfit > 0 ? { name: 'Profit', value: totalProfit } : null,
    totalExpenses > 0 ? { name: 'Expenses', value: totalExpenses } : null,
  ].filter((slice): slice is { name: string; value: number } => slice !== null)
}

export type DriverInput = { id: string; full_name: string }
export type DriverCollection = { driver_id: string | null; amount: number | string | null }
export type DriverTrip = { driver_id: string | null; expenses: number | string | null }

export type DriverStats = {
  driverId: string
  driverName: string
  collections: number
  expenses: number
  profit: number
  trips: number
}

export function driverLeaderboard(
  drivers: DriverInput[],
  collections: DriverCollection[],
  trips: DriverTrip[]
): DriverStats[] {
  const statsByDriver = new Map<string, DriverStats>()
  drivers.forEach((driver) => {
    statsByDriver.set(driver.id, {
      driverId: driver.id,
      driverName: driver.full_name,
      collections: 0,
      expenses: 0,
      profit: 0,
      trips: 0,
    })
  })

  collections.forEach((row) => {
    if (!row.driver_id) return
    const stats = statsByDriver.get(row.driver_id)
    if (!stats) return
    stats.collections += amountOf(row.amount)
  })

  trips.forEach((trip) => {
    if (!trip.driver_id) return
    const stats = statsByDriver.get(trip.driver_id)
    if (!stats) return
    stats.trips += 1
    stats.expenses += amountOf(trip.expenses)
  })

  statsByDriver.forEach((stats) => {
    stats.profit = stats.collections - stats.expenses
  })

  return Array.from(statsByDriver.values()).sort(
    (a, b) => b.profit - a.profit || b.collections - a.collections
  )
}
