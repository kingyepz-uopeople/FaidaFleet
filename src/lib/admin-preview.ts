import { hasSupabaseEnv } from './supabase/env'

/** Screenshot/dev only. Never active when real Supabase public env is present. */
export function isAdminUiPreview() {
  return process.env.NEXT_PUBLIC_ADMIN_UI_PREVIEW === '1' && !hasSupabaseEnv()
}

const now = '2026-10-20T09:00:00.000Z'
const lastWeek = '2026-10-13T09:00:00.000Z'
const lastMonth = '2026-09-18T09:00:00.000Z'

export type PreviewTenant = {
  id: string
  name: string
  business_name: string | null
  email: string | null
  phone: string | null
  plan: 'starter' | 'pro' | 'enterprise'
  is_active: boolean
  created_at: string
}

export const previewTenants: PreviewTenant[] = [
  { id: 't1', name: 'Westlands Matatu', business_name: 'Westlands Sacco', email: 'owner@westlands.ke', phone: '+254712345678', plan: 'pro', is_active: true, created_at: lastWeek },
  { id: 't2', name: 'Thika Super Metro', business_name: 'Super Metro Ltd', email: 'hello@supermetro.ke', phone: '+254722000111', plan: 'enterprise', is_active: true, created_at: lastMonth },
  { id: 't3', name: 'Kisumu City Link', business_name: null, email: 'ops@citylink.ke', phone: '+254733444555', plan: 'starter', is_active: false, created_at: '2026-08-02T09:00:00.000Z' },
]

export type PreviewDriver = {
  id: string
  full_name: string
  phone: string
  license_number: string | null
  license_expiry: string | null
  id_number: string | null
  is_active: boolean
  created_at: string
  tenant_id: string
  tenants: { name: string }
}

export const previewDrivers: PreviewDriver[] = [
  { id: 'd1', full_name: 'Amina Otieno', phone: '+254711223344', license_number: 'DL-88211', license_expiry: '2026-11-12', id_number: '32109876', is_active: true, created_at: lastWeek, tenant_id: 't1', tenants: { name: 'Westlands Matatu' } },
  { id: 'd2', full_name: 'Peter Mwangi', phone: '+254722334455', license_number: 'DL-44109', license_expiry: '2026-09-01', id_number: '29876543', is_active: true, created_at: lastMonth, tenant_id: 't2', tenants: { name: 'Thika Super Metro' } },
  { id: 'd3', full_name: 'Faith Wanjiku', phone: '+254733556677', license_number: 'DL-11920', license_expiry: '2027-04-18', id_number: '27654321', is_active: false, created_at: now, tenant_id: 't1', tenants: { name: 'Westlands Matatu' } },
]

export type PreviewCollection = {
  id: string
  amount: number
  date: string
  payment_method: 'cash' | 'mpesa' | 'pochi'
  reconciled: boolean
  drivers: { full_name: string }
  tenants: { name: string }
}

export const previewCollections: PreviewCollection[] = [
  { id: 'c1', amount: 18500, date: '2026-10-25', payment_method: 'mpesa', reconciled: true, drivers: { full_name: 'Amina Otieno' }, tenants: { name: 'Westlands Matatu' } },
  { id: 'c2', amount: 9200, date: '2026-10-24', payment_method: 'cash', reconciled: false, drivers: { full_name: 'Peter Mwangi' }, tenants: { name: 'Thika Super Metro' } },
  { id: 'c3', amount: 14300, date: '2026-10-23', payment_method: 'pochi', reconciled: true, drivers: { full_name: 'Faith Wanjiku' }, tenants: { name: 'Westlands Matatu' } },
]

export type PreviewPlan = {
  id: string
  name: string
  price: number
  description: string
  max_vehicles: number
  max_drivers: number
  features: string[]
  is_active: boolean
  created_at: string
}

export const previewPlans: PreviewPlan[] = [
  { id: 'p1', name: 'Starter', price: 0, description: 'Small fleets getting started', max_vehicles: 5, max_drivers: 8, features: ['Collections', 'Driver PIN login'], is_active: true, created_at: lastMonth },
  { id: 'p2', name: 'Pro', price: 4999, description: 'Growing operators', max_vehicles: 40, max_drivers: 80, features: ['Analytics', 'WhatsApp PIN reset', 'Support'], is_active: true, created_at: lastMonth },
  { id: 'p3', name: 'Enterprise', price: 14999, description: 'Multi-depot fleets', max_vehicles: 200, max_drivers: 400, features: ['Dedicated support', 'Custom reports'], is_active: true, created_at: lastMonth },
]

export type PreviewAdmin = {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'moderator'
  permissions: string[]
  is_active: boolean
  created_at: string
  last_login: string
}

export const previewAdmins: PreviewAdmin[] = [
  { id: 'a1', email: 'ian@faidafleet.com', full_name: 'Ian', role: 'super_admin' as const, permissions: ['manage_users'], is_active: true, created_at: lastMonth, last_login: now },
  { id: 'a2', email: 'ops@faidafleet.com', full_name: 'Operations', role: 'admin' as const, permissions: ['manage_fleets'], is_active: true, created_at: lastWeek, last_login: lastWeek },
]

export type PreviewTicket = {
  id: string
  title: string
  description: string
  status: 'open' | 'pending' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high'
  tenants: { name: string }
  created_at: string
}

export const previewTickets: PreviewTicket[] = [
  { id: 's1', title: 'Driver cannot sign in after PIN reset', description: 'Needs a new PIN sent on WhatsApp', status: 'open', priority: 'high', tenants: { name: 'Westlands Matatu' }, created_at: now },
  { id: 's2', title: 'M-Pesa collection mismatch', description: '', status: 'pending', priority: 'medium', tenants: { name: 'Thika Super Metro' }, created_at: lastWeek },
]

export type PreviewPinReset = {
  id: string
  actor_user_id: string
  actor_role: 'system_admin' | 'owner'
  target_kind: 'driver' | 'fleet_owner'
  target_user_id: string | null
  target_driver_id: string | null
  tenant_id: string
  created_at: string
}

export const previewPinResets: PreviewPinReset[] = [
  { id: 'r1', actor_user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', actor_role: 'system_admin', target_kind: 'driver', target_user_id: null, target_driver_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', tenant_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', created_at: now },
  { id: 'r2', actor_user_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', actor_role: 'owner', target_kind: 'driver', target_user_id: null, target_driver_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', tenant_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', created_at: lastWeek },
]
