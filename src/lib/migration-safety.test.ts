import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const migrationDir = join(process.cwd(), 'supabase', 'migrations')
const performanceMigration = readFileSync(join(migrationDir, '012_policy_and_foreign_key_performance.sql'), 'utf8')

/** Inventory final policy definitions from the checked-in migration history. */
function activeDirectAuthPolicies(): string[] {
  const policies = new Map<string, string>()
  for (const filename of readdirSync(migrationDir).filter((name) => /^0(0[1-9]|1[01])_.*\.sql$/.test(name)).sort()) {
    const sql = readFileSync(join(migrationDir, filename), 'utf8').replace(/--[^\n]*/g, '')
    const statements = /\b(drop\s+policy\s+if\s+exists|create\s+policy|alter\s+policy)\s+"([^"]+)"\s+on\s+(\w+\.\w+)([^;]*);/gi
    for (const match of sql.matchAll(statements)) {
      const [, action, name, table, body] = match
      const key = `${table}.${name}`
      if (action.toLowerCase().startsWith('drop')) policies.delete(key)
      else if (action.toLowerCase().startsWith('create')) policies.set(key, body)
      else if (policies.has(key)) policies.set(key, `${policies.get(key)} ${body}`)
    }
  }
  return [...policies.entries()].filter(([, body]) => /auth\.(uid|role|jwt|email)\s*\(/i.test(body)).map(([name]) => name).sort()
}

test('the policy inventory reflects the final 010/011 rules, not removed legacy rules', () => {
  assert.deepEqual(activeDirectAuthPolicies(), [
    'public.audit_logs.Users insert own audit logs',
    'public.collections.All members can record collections',
    'public.collections.Members can view tenant collections',
    'public.expenses.Members can view tenant expenses',
    'public.maintenance_logs.Members can view maintenance logs',
    'public.memberships.Users can view their memberships',
    'public.profiles.Users can insert own profile',
    'public.profiles.Users can update own profile',
    'public.profiles.Users can view own profile',
    'public.support_messages.Members send ticket messages',
    'public.support_tickets.Members create tenant tickets',
    'public.trips.Drivers can record own trips',
    'public.trips.Members can view trips',
    'storage.objects.Fuel pump photos scoped read',
  ])
})

test('policy rewrite is catalog-driven, preserves roles and clauses, and never recreates dropped legacy names', () => {
  assert.match(performanceMigration, /from pg_catalog\.pg_policies p/i)
  assert.match(performanceMigration, /where p\.schemaname in \('public', 'storage'\)/i)
  assert.match(performanceMigration, /DROP POLICY IF EXISTS %I ON %I\.%I/i)
  assert.match(performanceMigration, /CREATE POLICY %I ON %I\.%I AS %s FOR %s TO %s%s%s/i)
  for (const part of ['policy_row.permissive', 'policy_row.cmd', 'policy_row.roles', 'policy_row.qual', 'policy_row.with_check', 'policy_row.original_comment']) {
    assert.ok(performanceMigration.includes(part), part)
  }
  assert.doesNotMatch(performanceMigration, /create\s+policy\s+"/i)
})

test('foreign-key indexes are individually rerunnable and the duplicate drop is guarded', () => {
  const indexedColumns = [...performanceMigration.matchAll(/\('idx_fk_\w+', '(\w+)', '(\w+)'\)/gi)]
    .map((match) => `${match[1]}.${match[2]}`).sort()
  assert.match(performanceMigration, /CREATE INDEX IF NOT EXISTS %I ON public\.%I \(%I\)/i)
  assert.match(performanceMigration, /i\.indkey\[0\]/i)
  assert.match(performanceMigration, /i\.indpred is null/i)
  assert.deepEqual(indexedColumns, [
    'collections.driver_id', 'collections.reconciled_by', 'collections.recorded_by', 'collections.vehicle_id',
    'driver_assignments.driver_id', 'driver_assignments.vehicle_id', 'drivers.user_id',
    'expenses.recorded_by', 'expenses.vehicle_id', 'maintenance_logs.recorded_by', 'maintenance_logs.vehicle_id',
    'memberships.invited_by', 'mpesa_transactions.matched_collection_id', 'pin_reset_log.target_driver_id',
    'support_messages.sender_id', 'support_tickets.assigned_to', 'support_tickets.created_by', 'trips.recorded_by',
  ])
  assert.match(performanceMigration, /keeper\.indisunique/i)
  assert.match(performanceMigration, /redundant\.indrelid = to_regclass\('public\.mpesa_transactions'\)/i)
  assert.match(performanceMigration, /a\.attname = 'trans_id'/i)
  assert.match(performanceMigration, /conindid = keeper\.indexrelid and contype = 'u'/i)
  assert.match(performanceMigration, /redundant\.indisready and keeper\.indisready/i)
  assert.match(performanceMigration, /not exists \(select 1 from pg_catalog\.pg_constraint where conindid = redundant\.indexrelid\)/i)
  assert.match(performanceMigration, /drop index if exists public\.idx_mpesa_trans_id/i)
})
