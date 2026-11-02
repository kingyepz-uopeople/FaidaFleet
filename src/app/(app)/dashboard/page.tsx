import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  amountOf,
  buildWeeklySeries,
  collectionStatus,
  complianceIssues,
  dashboardTotalsFromRows,
  missingDashboardTotals,
  reconciliationFromCounts,
  type CollectionRow,
  type MoneyRow,
} from '@/lib/fleet-metrics'
import { trailingDateRange } from '@/lib/report-range'
import { accountLabel } from '@/lib/phone'
import { isDriverOnly, primaryMembership } from '@/lib/fleet-access'
import { requestFleetAccess } from '@/lib/supabase/request-fleet-access'
import { FleetHome, type RecentCollection } from './dashboard-view'

export const dynamic = 'force-dynamic'

type VehicleRow = {
  id: string
  registration_number: string
  insurance_expiry: string | null
  mot_expiry: string | null
}

type RecentRow = {
  id: string
  date: string
  amount: number | string | null
  payment_method: string | null
  reconciled: boolean | null
  vehicles: { registration_number: string } | { registration_number: string }[] | null
}

function registrationOf(vehicles: RecentRow['vehicles']) {
  if (!vehicles) return 'N/A'
  if (Array.isArray(vehicles)) return vehicles[0]?.registration_number || 'N/A'
  return vehicles.registration_number || 'N/A'
}

export default async function DashboardPage() {
  const { user, memberships: membershipRows } = await requestFleetAccess()
  if (!user) redirect('/login')

  // Preserve the dashboard's own redirects even when a layout is reused during
  // client navigation. The middleware-verified result contains all memberships.
  if (isDriverOnly(membershipRows)) redirect('/trips')
  const membership = primaryMembership(membershipRows)
  if (!membership) redirect('/onboarding')

  const tenantId = membership.tenant_id
  const supabase = await createClient()
  const chartRange = trailingDateRange(7)
  const [vehiclesRes, driversRes, chartCollectionsRes, chartExpensesRes, recentRes, tenantRes, profileRes, totalsRes] = await Promise.all([
    supabase.from('vehicles').select('id, registration_number, insurance_expiry, mot_expiry').eq('tenant_id', tenantId),
    supabase.from('drivers').select('id').eq('tenant_id', tenantId).eq('is_active', true),
    // Raw rows are only needed for the seven-day chart. Lifetime card totals
    // come from the read-only 016 helper, with a safe fallback until installed.
    supabase.from('collections').select('date, amount').eq('tenant_id', tenantId).gte('date', chartRange.start).lte('date', chartRange.end),
    supabase.from('expenses').select('date, amount').eq('tenant_id', tenantId).gte('date', chartRange.start).lte('date', chartRange.end),
    supabase.from('collections').select('id, date, amount, payment_method, reconciled, vehicles(registration_number)').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(5),
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.rpc('fleet_dashboard_totals', { p_tenant_id: tenantId }).single(),
  ])

  let totalsError = totalsRes.error
  let totals = totalsRes.data ? {
    totalCollections: Number(totalsRes.data.total_collections),
    totalExpenses: Number(totalsRes.data.total_expenses),
    collectionCount: Number(totalsRes.data.collection_count),
    expenseCount: Number(totalsRes.data.expense_count),
    reconciliation: reconciliationFromCounts(Number(totalsRes.data.electronic_count), Number(totalsRes.data.reconciled_count)),
  } : null
  if (!totals && missingDashboardTotals(totalsRes.error)) {
    const [collectionsRes, expensesRes] = await Promise.all([
      supabase.from('collections').select('date, amount, payment_method, reconciled').eq('tenant_id', tenantId),
      supabase.from('expenses').select('date, amount').eq('tenant_id', tenantId),
    ])
    totalsError = collectionsRes.error || expensesRes.error
    if (!totalsError) totals = dashboardTotalsFromRows((collectionsRes.data || []) as CollectionRow[], (expensesRes.data || []) as MoneyRow[])
  }

  const queryError = [vehiclesRes.error, driversRes.error, chartCollectionsRes.error, chartExpensesRes.error, recentRes.error, tenantRes.error, totalsError]
    .find((error) => error)

  const vehicles = (vehiclesRes.data || []) as VehicleRow[]
  const chartCollections = (chartCollectionsRes.data || []) as MoneyRow[]
  const chartExpenses = (chartExpensesRes.data || []) as MoneyRow[]
  const recentRows = (recentRes.data || []) as RecentRow[]

  const recent: RecentCollection[] = recentRows.map((row) => ({
    id: row.id,
    registration: registrationOf(row.vehicles),
    paymentMethod: row.payment_method || 'cash',
    amount: amountOf(row.amount),
    status: collectionStatus(row),
  }))

  return (
    <FleetHome
      userName={profileRes.data?.full_name || accountLabel(user)}
      fleetName={tenantRes.data?.name || 'Your Fleet'}
      vehicleCount={vehicles.length}
      driverCount={driversRes.data?.length || 0}
      totalCollections={totals?.totalCollections || 0}
      totalExpenses={totals?.totalExpenses || 0}
      collectionCount={totals?.collectionCount || 0}
      expenseCount={totals?.expenseCount || 0}
      reconciliation={totals?.reconciliation || reconciliationFromCounts(0, 0)}
      chartData={buildWeeklySeries(chartCollections, chartExpenses)}
      recent={recent}
      compliance={complianceIssues(vehicles)}
      error={queryError?.message}
    />
  )
}
