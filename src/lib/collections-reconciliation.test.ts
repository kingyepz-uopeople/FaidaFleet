import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
  applyReconciliationToCollections,
  canReconcileCollections,
  findReconcileMembership,
  formatReconciledDate,
  formatReconciledDetails,
  isElectronicCollectionMethod,
  isPendingReconcilableCollection,
  isReconciledElectronicCollection,
  normalizeCollectionReceipt,
  pruneSelectedPendingIds,
  reconcilePatch,
  reconciliationFieldsForEdit,
  shouldResetReconciliationOnEdit,
  unreconcilePatch,
  validateReconcileRequest,
} from './collections-reconciliation'
import { collectionStatus, reconciliationStats } from './fleet-metrics'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

test('only owners and admins can reconcile collections, scoped to the target tenant', () => {
  assert.equal(canReconcileCollections('owner'), true)
  assert.equal(canReconcileCollections('admin'), true)
  assert.equal(canReconcileCollections('OWNER'), true)
  assert.equal(canReconcileCollections('driver'), false)
  assert.equal(canReconcileCollections('accountant'), false)
  assert.equal(canReconcileCollections(null), false)
  assert.equal(canReconcileCollections(''), false)

  const memberships = [
    { tenant_id: 'tenant-a', role: 'owner' },
    { tenant_id: 'tenant-b', role: 'driver' },
    { tenant_id: 'tenant-c', role: 'accountant' },
    { tenant_id: 'tenant-d', role: 'admin' },
  ]
  assert.deepEqual(findReconcileMembership(memberships, 'tenant-a'), {
    tenant_id: 'tenant-a',
    role: 'owner',
  })
  assert.deepEqual(findReconcileMembership(memberships, 'tenant-d'), {
    tenant_id: 'tenant-d',
    role: 'admin',
  })
  // Being an owner in tenant-a never grants reconciliation rights in tenant-b or tenant-c.
  assert.equal(findReconcileMembership(memberships, 'tenant-b'), null)
  assert.equal(findReconcileMembership(memberships, 'tenant-c'), null)
  assert.equal(findReconcileMembership(memberships, 'other-tenant'), null)
  assert.equal(findReconcileMembership(memberships, null), null)
})

test('M-Pesa and Pochi use manual reconciliation while cash stays recorded', () => {
  assert.equal(isElectronicCollectionMethod('mpesa'), true)
  assert.equal(isElectronicCollectionMethod('pochi'), true)
  assert.equal(isElectronicCollectionMethod('cash'), false)

  assert.equal(normalizeCollectionReceipt('mpesa', '  SLE123ABC  '), 'SLE123ABC')
  assert.equal(normalizeCollectionReceipt('pochi', '  PCH999XYZ '), 'PCH999XYZ')
  assert.equal(normalizeCollectionReceipt('mpesa', '   '), null)
  assert.equal(normalizeCollectionReceipt('cash', 'SLE123ABC'), null)

  assert.equal(isPendingReconcilableCollection({ payment_method: 'mpesa', reconciled: false }), true)
  assert.equal(isPendingReconcilableCollection({ payment_method: 'pochi', reconciled: false }), true)
  assert.equal(isPendingReconcilableCollection({ payment_method: 'mpesa', reconciled: true }), false)
  assert.equal(isPendingReconcilableCollection({ payment_method: 'cash', reconciled: false }), false)

  assert.equal(isReconciledElectronicCollection({ payment_method: 'mpesa', reconciled: true }), true)
  assert.equal(isReconciledElectronicCollection({ payment_method: 'pochi', reconciled: true }), true)
  assert.equal(isReconciledElectronicCollection({ payment_method: 'cash', reconciled: true }), false)
  assert.equal(collectionStatus({ payment_method: 'cash', reconciled: false }), 'Recorded')
})

test('reconcilePatch stamps timestamp and user UUID while unreconcilePatch clears all three fields', () => {
  const fixedNow = new Date('2026-10-29T09:15:30.000Z')
  assert.deepEqual(reconcilePatch(OWNER_ID, fixedNow), {
    reconciled: true,
    reconciled_at: '2026-10-29T09:15:30.000Z',
    reconciled_by: OWNER_ID,
  })
  assert.throws(() => reconcilePatch('not-a-uuid', fixedNow), /valid user/i)
  assert.deepEqual(unreconcilePatch(), {
    reconciled: false,
    reconciled_at: null,
    reconciled_by: null,
  })
})

test('editing amount, receipt code, or switching to cash resets a reconciled collection to Pending', () => {
  const verified = {
    amount: 2500,
    payment_method: 'mpesa',
    mpesa_receipt: 'SLE456GHI',
    reconciled: true,
  }

  // Amount changed -> reset to Pending
  assert.equal(
    shouldResetReconciliationOnEdit(verified, {
      amount: 2600,
      payment_method: 'mpesa',
      mpesa_receipt: 'SLE456GHI',
    }),
    true,
  )
  assert.deepEqual(
    reconciliationFieldsForEdit(verified, {
      amount: 2600,
      payment_method: 'mpesa',
      mpesa_receipt: 'SLE456GHI',
    }),
    { reconciled: false, reconciled_at: null, reconciled_by: null },
  )

  // Receipt code changed -> reset to Pending
  assert.equal(
    shouldResetReconciliationOnEdit(verified, {
      amount: 2500,
      payment_method: 'mpesa',
      mpesa_receipt: 'SLE456ZZZ',
    }),
    true,
  )
  // Receipt cleared -> reset to Pending
  assert.equal(
    shouldResetReconciliationOnEdit(verified, {
      amount: 2500,
      payment_method: 'mpesa',
      mpesa_receipt: null,
    }),
    true,
  )
  // Switched to cash -> reset reconciliation metadata
  assert.equal(
    shouldResetReconciliationOnEdit(verified, {
      amount: 2500,
      payment_method: 'cash',
      mpesa_receipt: null,
    }),
    true,
  )

  // Same amount and same trimmed receipt (e.g. only notes or shift edited) -> stays verified
  assert.equal(
    shouldResetReconciliationOnEdit(verified, {
      amount: 2500,
      payment_method: 'mpesa',
      mpesa_receipt: '  SLE456GHI  ',
    }),
    false,
  )
  assert.deepEqual(
    reconciliationFieldsForEdit(verified, {
      amount: 2500,
      payment_method: 'mpesa',
      mpesa_receipt: 'SLE456GHI',
    }),
    {},
  )

  // Already-pending rows do not emit a redundant reset patch
  assert.deepEqual(
    reconciliationFieldsForEdit(
      { ...verified, reconciled: false },
      { amount: 9000, payment_method: 'mpesa', mpesa_receipt: 'NEW999' },
    ),
    {},
  )
})

test('in-place state updates and bulk selection pruning update rows and reconciliation rate without reload', () => {
  const initial = [
    {
      id: 'c-cash',
      date: '2026-10-29',
      amount: 4000,
      payment_method: 'cash',
      reconciled: false,
      reconciled_at: null,
      reconciled_by: null,
    },
    {
      id: 'c-mpesa',
      date: '2026-10-29',
      amount: 1500,
      payment_method: 'mpesa',
      reconciled: false,
      reconciled_at: null,
      reconciled_by: null,
    },
    {
      id: 'c-pochi',
      date: '2026-10-29',
      amount: 2000,
      payment_method: 'pochi',
      reconciled: false,
      reconciled_at: null,
      reconciled_by: null,
    },
  ]

  assert.equal(reconciliationStats(initial).rate, 0)

  // Bulk selection ignores cash and non-visible rows
  const selected = new Set(['c-cash', 'c-mpesa', 'c-pochi', 'filtered-out'])
  assert.deepEqual(pruneSelectedPendingIds(selected, initial), ['c-mpesa', 'c-pochi'])

  // Bulk reconcile updates both electronic rows and brings rate to 100%
  const afterBulk = applyReconciliationToCollections(
    initial,
    ['c-mpesa', 'c-pochi'],
    reconcilePatch(OWNER_ID, new Date('2026-10-29T12:00:00.000Z')),
  )
  assert.equal(reconciliationStats(afterBulk).rate, 100)
  assert.equal(afterBulk[0].reconciled, false)
  assert.equal(afterBulk[1].reconciled_by, OWNER_ID)
  assert.equal(afterBulk[2].reconciled_at, '2026-10-29T12:00:00.000Z')
  assert.deepEqual(pruneSelectedPendingIds(selected, afterBulk), [])

  // Unreconcile returns a single row to Pending and updates the rate to 50%
  const afterUndo = applyReconciliationToCollections(afterBulk, ['c-pochi'], unreconcilePatch())
  assert.equal(reconciliationStats(afterUndo).rate, 50)
  assert.equal(afterUndo[2].reconciled, false)
  assert.equal(afterUndo[2].reconciled_at, null)
  assert.equal(afterUndo[2].reconciled_by, null)
})

test('row details format reconciled date and verifier cleanly', () => {
  assert.equal(formatReconciledDate('2026-10-29'), 'Oct 29, 2026')
  assert.equal(formatReconciledDate('not-a-date'), null)

  const row = {
    payment_method: 'pochi',
    reconciled: true,
    reconciled_at: '2026-10-29',
    reconciled_by: OWNER_ID,
  }
  const names = { [OWNER_ID]: 'Alice Wanjiku', [ADMIN_ID]: 'Bob Kamau' }

  assert.equal(
    formatReconciledDetails(row, { currentUserId: OWNER_ID, reconcilerNames: names }),
    'Reconciled Oct 29, 2026 by Alice Wanjiku (you)',
  )
  assert.equal(
    formatReconciledDetails(row, { currentUserId: ADMIN_ID, reconcilerNames: names }),
    'Reconciled Oct 29, 2026 by Alice Wanjiku',
  )
  assert.equal(
    formatReconciledDetails(row, { currentUserId: OWNER_ID, reconcilerNames: {} }),
    'Reconciled Oct 29, 2026 by You',
  )
  assert.equal(
    formatReconciledDetails(row, { currentUserId: ADMIN_ID, reconcilerNames: {} }),
    'Reconciled Oct 29, 2026 by Fleet manager',
  )
  // Cash and Pending rows never render a reconciled detail caption
  assert.equal(
    formatReconciledDetails(
      { ...row, payment_method: 'cash' },
      { currentUserId: OWNER_ID, reconcilerNames: names },
    ),
    null,
  )
  assert.equal(
    formatReconciledDetails(
      { ...row, reconciled: false },
      { currentUserId: OWNER_ID, reconcilerNames: names },
    ),
    null,
  )
})

test('migration 015 is idempotent, guards collections reconciliation, and leaves mpesa_transactions untouched', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '015_collections_reconciliation_guard.sql'),
    'utf8',
  )
  assert.match(sql, /create or replace function public\.enforce_collection_reconciliation_rules\(\)/i)
  assert.match(sql, /if to_regclass\('public\.collections'\) is not null then/i)
  assert.match(sql, /drop trigger if exists enforce_collection_reconciliation on public\.collections/i)
  assert.match(sql, /public\.has_any_tenant_role\(new\.tenant_id, array\['owner', 'admin'\]\)/i)
  assert.doesNotMatch(sql, /\bmpesa_transactions\b/i)
})

test('server request validator rejects drivers, accountants, temporary PINs, and cross-tenant requests', () => {
  const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const COL_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const COL_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

  // Driver calling API directly -> 403
  assert.deepEqual(
    validateReconcileRequest({
      userId: OWNER_ID,
      mustChangePin: false,
      memberships: [{ tenant_id: TENANT_A, role: 'driver' }],
      body: { tenantId: TENANT_A, action: 'reconcile', ids: [COL_1] },
    }),
    {
      ok: false,
      status: 403,
      error: 'Only fleet owners and admins can reconcile collections.',
    },
  )

  // Accountant calling API directly -> 403
  assert.equal(
    validateReconcileRequest({
      userId: OWNER_ID,
      mustChangePin: false,
      memberships: [{ tenant_id: TENANT_A, role: 'accountant' }],
      body: { tenantId: TENANT_A, action: 'reconcile', ids: [COL_1] },
    }).ok,
    false,
  )

  // Owner of TENANT_A attempting to reconcile TENANT_B -> 403
  assert.deepEqual(
    validateReconcileRequest({
      userId: OWNER_ID,
      mustChangePin: false,
      memberships: [{ tenant_id: TENANT_A, role: 'owner' }],
      body: { tenantId: TENANT_B, action: 'reconcile', ids: [COL_1] },
    }),
    {
      ok: false,
      status: 403,
      error: 'Only fleet owners and admins can reconcile collections.',
    },
  )

  // Temporary PIN must be changed first -> 403
  assert.equal(
    validateReconcileRequest({
      userId: OWNER_ID,
      mustChangePin: true,
      memberships: [{ tenant_id: TENANT_A, role: 'owner' }],
      body: { tenantId: TENANT_A, action: 'reconcile', ids: [COL_1] },
    }).ok,
    false,
  )

  // Unreconcile rejects multiple IDs -> 400
  assert.deepEqual(
    validateReconcileRequest({
      userId: OWNER_ID,
      mustChangePin: false,
      memberships: [{ tenant_id: TENANT_A, role: 'owner' }],
      body: { tenantId: TENANT_A, action: 'unreconcile', ids: [COL_1, COL_2] },
    }),
    {
      ok: false,
      status: 400,
      error: 'Unreconcile one collection at a time.',
    },
  )

  // Valid bulk reconcile deduplicates IDs and succeeds for owner/admin of TENANT_A
  assert.deepEqual(
    validateReconcileRequest({
      userId: ADMIN_ID,
      mustChangePin: false,
      memberships: [{ tenant_id: TENANT_A, role: 'admin' }],
      body: { tenantId: TENANT_A, action: 'reconcile', ids: [COL_1, COL_2, COL_1] },
    }),
    {
      ok: true,
      tenantId: TENANT_A,
      action: 'reconcile',
      ids: [COL_1, COL_2],
    },
  )
})

test('dead AI reconcile client and hardcoded demo tenant-123 action are removed', () => {
  assert.equal(
    existsSync(join(process.cwd(), 'src', 'app', '(app)', 'collections', 'reconciliation-client.tsx')),
    false,
  )
  assert.equal(existsSync(join(process.cwd(), 'src', 'app', 'actions.ts')), false)
  assert.equal(existsSync(join(process.cwd(), 'src', 'lib', 'data.ts')), false)
})
