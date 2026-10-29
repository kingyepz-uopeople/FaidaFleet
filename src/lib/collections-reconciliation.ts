import { isUuid, requireUuid } from './db'
import type { MembershipLike } from './fleet-access'

export type CollectionPaymentMethod = 'cash' | 'mpesa' | 'pochi'

export type ReconcilableRow = {
  payment_method: string | null
  reconciled: boolean | null
}

export type ReconciledMetadataRow = ReconcilableRow & {
  reconciled_at: string | null
  reconciled_by: string | null
}

export type ReconciliationMutationPatch = {
  reconciled: boolean
  reconciled_at: string | null
  reconciled_by: string | null
}

const RECONCILE_ROLES = new Set(['owner', 'admin'])
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Only fleet owners and admins may reconcile or unreconcile collections. */
export function canReconcileCollections(role: string | null | undefined): boolean {
  return RECONCILE_ROLES.has((role || '').trim().toLowerCase())
}

/**
 * Finds an active owner/admin membership for the requested tenant.
 * Enforces both role eligibility and tenant isolation when a user belongs to multiple fleets.
 */
export function findReconcileMembership<T extends MembershipLike>(
  memberships: readonly T[] | null | undefined,
  tenantId: string | null | undefined,
): T | null {
  if (!tenantId) return null
  const list = memberships || []
  for (const role of ['owner', 'admin']) {
    const match = list.find(
      (row) => row.tenant_id === tenantId && (row.role || '').toLowerCase() === role,
    )
    if (match) return match
  }
  return null
}

export function isElectronicCollectionMethod(
  method: string | null | undefined,
): method is 'mpesa' | 'pochi' {
  return method === 'mpesa' || method === 'pochi'
}

/** M-Pesa and Pochi carry statement receipt codes; cash collections store NULL. */
export function normalizeCollectionReceipt(
  paymentMethod: string | null | undefined,
  receipt: string | null | undefined,
): string | null {
  if (!isElectronicCollectionMethod(paymentMethod)) return null
  const trimmed = (receipt || '').trim()
  return trimmed || null
}

/** True only for M-Pesa and Pochi collections that are still Pending. */
export function isPendingReconcilableCollection(row: ReconcilableRow): boolean {
  return isElectronicCollectionMethod(row.payment_method) && !row.reconciled
}

/** True only for M-Pesa and Pochi collections that have been marked Reconciled. */
export function isReconciledElectronicCollection(row: ReconcilableRow): boolean {
  return isElectronicCollectionMethod(row.payment_method) && Boolean(row.reconciled)
}

export function reconcilePatch(
  userId: string | null | undefined,
  now: Date = new Date(),
): { reconciled: true; reconciled_at: string; reconciled_by: string } {
  const validUserId = requireUuid(userId, 'user')
  return {
    reconciled: true,
    reconciled_at: now.toISOString(),
    reconciled_by: validUserId,
  }
}

export function unreconcilePatch(): {
  reconciled: false
  reconciled_at: null
  reconciled_by: null
} {
  return {
    reconciled: false,
    reconciled_at: null,
    reconciled_by: null,
  }
}

export type EditableCollectionSnapshot = {
  amount: number | string
  payment_method: string
  mpesa_receipt: string | null
  reconciled: boolean
}

export type NextCollectionValues = {
  amount: number
  payment_method: string
  mpesa_receipt: string | null
}

/**
 * Editing the amount or receipt code (or switching to cash) on a reconciled
 * collection must reset it to Pending so a modified row is never left verified.
 */
export function shouldResetReconciliationOnEdit(
  existing: EditableCollectionSnapshot,
  next: NextCollectionValues,
): boolean {
  if (!existing.reconciled) return false
  if (!isElectronicCollectionMethod(next.payment_method)) return true

  const prevAmount = typeof existing.amount === 'number' ? existing.amount : Number(existing.amount)
  if (prevAmount !== next.amount) return true

  const prevReceipt = normalizeCollectionReceipt(existing.payment_method, existing.mpesa_receipt)
  const nextReceipt = normalizeCollectionReceipt(next.payment_method, next.mpesa_receipt)
  return prevReceipt !== nextReceipt
}

export function reconciliationFieldsForEdit(
  existing: EditableCollectionSnapshot,
  next: NextCollectionValues,
): Partial<ReconciliationMutationPatch> {
  if (shouldResetReconciliationOnEdit(existing, next)) {
    return unreconcilePatch()
  }
  return {}
}

/** Updates matching collection rows in memory so rows and KPI cards refresh without a page reload. */
export function applyReconciliationToCollections<
  T extends {
    id: string
    reconciled: boolean
    reconciled_at: string | null
    reconciled_by: string | null
  },
>(rows: readonly T[], updatedIds: Iterable<string>, patch: ReconciliationMutationPatch): T[] {
  const idSet = new Set(updatedIds)
  if (idSet.size === 0) return [...rows]
  return rows.map((row) => (idSet.has(row.id) ? { ...row, ...patch } : row))
}

/** Filters a selection set down to currently visible Pending M-Pesa/Pochi collection IDs. */
export function pruneSelectedPendingIds<T extends ReconcilableRow & { id: string }>(
  selectedIds: ReadonlySet<string>,
  visibleRows: readonly T[],
): string[] {
  if (selectedIds.size === 0) return []
  return visibleRows
    .filter((row) => selectedIds.has(row.id) && isPendingReconcilableCollection(row))
    .map((row) => row.id)
}

/** Formats an ISO timestamptz value as a readable local calendar date (`Oct 29, 2026`). */
export function formatReconciledDate(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number)
    const local = new Date(year, (month || 1) - 1, day || 1)
    if (Number.isNaN(local.getTime())) return null
    return `${MONTHS[local.getMonth()]} ${String(local.getDate()).padStart(2, '0')}, ${local.getFullYear()}`
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return `${MONTHS[parsed.getMonth()]} ${String(parsed.getDate()).padStart(2, '0')}, ${parsed.getFullYear()}`
}

export function formatReconcilerLabel(
  reconciledBy: string | null | undefined,
  options?: {
    currentUserId?: string | null
    reconcilerNames?: Readonly<Record<string, string>>
  },
): string | null {
  if (!reconciledBy) return null
  const knownName = options?.reconcilerNames?.[reconciledBy]?.trim() || ''
  if (options?.currentUserId && reconciledBy === options.currentUserId) {
    return knownName ? `${knownName} (you)` : 'You'
  }
  return knownName || 'Fleet manager'
}

/** Builds a concise row-detail caption showing when a collection was reconciled and by whom. */
export function formatReconciledDetails(
  row: ReconciledMetadataRow,
  options?: {
    currentUserId?: string | null
    reconcilerNames?: Readonly<Record<string, string>>
  },
): string | null {
  if (!isReconciledElectronicCollection(row)) return null
  const dateLabel = formatReconciledDate(row.reconciled_at)
  const whoLabel = formatReconcilerLabel(row.reconciled_by, options)

  if (dateLabel && whoLabel) return `Reconciled ${dateLabel} by ${whoLabel}`
  if (dateLabel) return `Reconciled ${dateLabel}`
  if (whoLabel) return `Reconciled by ${whoLabel}`
  return null
}

export const MAX_BULK_RECONCILE_IDS = 200

export type ValidatedReconcileRequest =
  | {
      ok: true
      tenantId: string
      action: 'reconcile' | 'unreconcile'
      ids: string[]
    }
  | {
      ok: false
      status: 400 | 401 | 403
      error: string
    }

export function validateReconcileRequest(input: {
  userId: string | null | undefined
  mustChangePin: boolean
  memberships: readonly MembershipLike[] | null | undefined
  body: Record<string, unknown> | null | undefined
}): ValidatedReconcileRequest {
  if (!input.userId || !isUuid(input.userId)) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }
  if (input.mustChangePin) {
    return {
      ok: false,
      status: 403,
      error: 'Set your own PIN in Settings before reconciling collections.',
    }
  }
  if (!input.body || typeof input.body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid request body' }
  }

  const tenantId = typeof input.body.tenantId === 'string' ? input.body.tenantId.trim() : ''
  if (!isUuid(tenantId)) {
    return { ok: false, status: 400, error: 'Valid fleet ID is required' }
  }

  const action =
    input.body.action === 'reconcile' || input.body.action === 'unreconcile'
      ? input.body.action
      : null
  if (!action) {
    return { ok: false, status: 400, error: 'Specify reconcile or unreconcile' }
  }

  const rawIds = input.body.ids
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > MAX_BULK_RECONCILE_IDS) {
    return {
      ok: false,
      status: 400,
      error: `Select between 1 and ${MAX_BULK_RECONCILE_IDS} valid collection records.`,
    }
  }

  const uniqueIds = new Set<string>()
  for (const item of rawIds) {
    if (!isUuid(item)) {
      return {
        ok: false,
        status: 400,
        error: `Select between 1 and ${MAX_BULK_RECONCILE_IDS} valid collection records.`,
      }
    }
    uniqueIds.add(item.trim())
  }
  const ids = Array.from(uniqueIds)

  if (action === 'unreconcile' && ids.length !== 1) {
    return { ok: false, status: 400, error: 'Unreconcile one collection at a time.' }
  }

  if (!findReconcileMembership(input.memberships, tenantId)) {
    return {
      ok: false,
      status: 403,
      error: 'Only fleet owners and admins can reconcile collections.',
    }
  }

  return { ok: true, tenantId, action, ids }
}

