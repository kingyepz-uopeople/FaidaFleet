import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  amountOf,
  buildWeeklySeries,
  collectionStatus,
  complianceIssues,
  reconciliationStats,
  sumAmounts,
  type CollectionRow,
  type MoneyRow,
} from '@/lib/fleet-metrics'
import { accountLabel } from '@/lib/phone'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/onboarding')

  const tenantId = membership.tenant_id
  const [vehiclesRes, driversRes, collectionsRes, expensesRes, recentRes, tenantRes, profileRes] = await Promise.all([
    supabase.from('vehicles').select('id, registration_number, insurance_expiry, mot_expiry').eq('tenant_id', tenantId),
    supabase.from('drivers').select('id').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('collections').select('date, amount, payment_method, reconciled').eq('tenant_id', tenantId),
    supabase.from('expenses').select('date, amount').eq('tenant_id', tenantId),
    supabase.from('collections').select('id, date, amount, payment_method, reconciled, vehicles(registration_number)').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(5),
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  const queryError = [vehiclesRes.error, driversRes.error, collectionsRes.error, expensesRes.error, recentRes.error, tenantRes.error]
    .find((error) => error)

  const vehicles = (vehiclesRes.data || []) as VehicleRow[]
  const collections = (collectionsRes.data || []) as CollectionRow[]
  const expenses = (expensesRes.data || []) as MoneyRow[]
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
      totalCollections={sumAmounts(collections)}
      totalExpenses={sumAmounts(expenses)}
      collectionCount={collections.length}
      expenseCount={expenses.length}
      reconciliation={reconciliationStats(collections)}
      chartData={buildWeeklySeries(collections, expenses)}
      recent={recent}
      compliance={complianceIssues(vehicles)}
      error={queryError?.message}
    />
  )
}
