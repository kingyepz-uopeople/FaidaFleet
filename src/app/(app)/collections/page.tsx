'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  PlusCircle,
  Loader2,
  Trash2,
  Edit,
  Wallet,
  TrendingUp,
  BadgeCheck,
  Check,
} from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { optionalNotes, withRecordedBy } from '@/lib/record-payload';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { collectionStatus, reconciliationStats } from '@/lib/fleet-metrics';
import {
  applyReconciliationToCollections,
  canReconcileCollections,
  formatReconciledDetails,
  isElectronicCollectionMethod,
  isPendingReconcilableCollection,
  isReconciledElectronicCollection,
  normalizeCollectionReceipt,
  pruneSelectedPendingIds,
  reconciliationFieldsForEdit,
  shouldResetReconciliationOnEdit,
} from '@/lib/collections-reconciliation';
import { EmptyState, LoadFailure, PageShell, TableScroll } from '@/components/page-shell';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { StatCard } from '@/components/stat-card';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { DriverScopeNotice, LockedValue } from '@/components/driver-scope';
import { RecordOriginBadge } from '@/components/record-origin-badge';
import { cn } from '@/lib/utils';

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
const COLLECTION_SELECT = '*, vehicles(registration_number), drivers(full_name, user_id)';

type PaymentMethod = 'cash' | 'mpesa' | 'pochi';
type Shift = 'morning' | 'afternoon' | 'evening' | 'night';
type StatusFilter = 'all' | 'Pending' | 'Reconciled' | 'Recorded';

type Collection = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  amount: number;
  payment_method: PaymentMethod;
  mpesa_receipt: string | null;
  date: string;
  shift: Shift | null;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  notes: string | null;
  recorded_by: string | null;
  vehicles: { registration_number: string } | null;
  drivers: { full_name: string; user_id: string | null } | null;
};

type ReconcileApiRow = {
  id: string;
  reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
};

type Option = { id: string; label: string };

const EMPTY_FORM = {
  vehicleId: '',
  driverId: '',
  amount: '',
  paymentMethod: 'cash' as PaymentMethod,
  mpesaReceipt: '',
  date: new Date().toISOString().split('T')[0],
  shift: 'morning' as Shift,
  notes: '',
};

function methodLabel(method: string) {
  if (method === 'mpesa') return 'M-Pesa';
  if (method === 'pochi') return 'Pochi';
  return 'Cash';
}

function statusBadgeClass(status: 'Recorded' | 'Reconciled' | 'Pending') {
  if (status === 'Pending') {
    return 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950/60';
  }
  return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-950/60';
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [drivers, setDrivers] = useState<Option[]>([]);
  const [reconcilerNames, setReconcilerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchDate, setSearchDate] = useState('');
  const [filterMethod, setFilterMethod] = useState<'all' | PaymentMethod>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [reconcilingIds, setReconcilingIds] = useState<Set<string>>(() => new Set());
  const [unreconcileTarget, setUnreconcileTarget] = useState<Collection | null>(null);
  const [unreconciling, setUnreconciling] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    userId,
    tenantId,
    role,
    isDriver,
    driverId,
    driverName,
    vehicleId,
    vehicleLabel,
    loadError: accessError,
  } = useFleetAccess();

  const canRecord = !isDriver || Boolean(driverId && vehicleId);
  const canReconcile = !isDriver && canReconcileCollections(role);
  const scopeKey = `${tenantId || ''}:${userId || ''}:${role || ''}:${isDriver}`;

  useEffect(() => {
    setSelectedIds(new Set());
    setUnreconcileTarget(null);
    setDialogOpen(false);
    setEditing(null);
  }, [scopeKey]);

  const loadReconcilerNames = useCallback(async (activeTenantId: string) => {
    try {
      const response = await fetch(
        `/api/collections/reconcile?tenantId=${encodeURIComponent(activeTenantId)}`,
      );
      if (!response.ok) return;
      const payload = (await response.json()) as { reconcilers?: Record<string, string> };
      if (payload.reconcilers) {
        setReconcilerNames((previous) => ({ ...previous, ...payload.reconcilers }));
      }
    } catch {
      // Non-fatal: row details still fall back to 'You' / 'Fleet manager'.
    }
  }, []);

  useEffect(() => {
    if (!accessLoading) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, tenantId, isDriver, driverId, vehicleId, canReconcile]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      if (!tenantId) {
        setLoadError(accessError || 'No fleet is linked to this account yet. Finish onboarding to record collections.');
        return;
      }

      const [collectionsRes, vehiclesRes, driversRes] = await Promise.all([
        (isDriver
          ? supabase
              .from('collections')
              .select(COLLECTION_SELECT)
              .eq('tenant_id', tenantId)
              .eq('driver_id', driverId || NO_MATCH_UUID)
          : supabase
              .from('collections')
              .select(COLLECTION_SELECT)
              .eq('tenant_id', tenantId)
        ).order('created_at', { ascending: false }).order('date', { ascending: false }),
        isDriver
          ? supabase.from('vehicles').select('id, registration_number').eq('id', vehicleId || NO_MATCH_UUID).limit(1)
          : supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tenantId).eq('is_active', true).order('registration_number'),
        isDriver
          ? supabase.from('drivers').select('id, full_name').eq('id', driverId || NO_MATCH_UUID).limit(1)
          : supabase.from('drivers').select('id, full_name').eq('tenant_id', tenantId).eq('is_active', true).order('full_name'),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setCollections((collectionsRes.data || []) as Collection[]);
      setVehicles((vehiclesRes.data || []).map((row) => ({ id: row.id, label: row.registration_number })));
      setDrivers((driversRes.data || []).map((row) => ({ id: row.id, label: row.full_name })));

      if (canReconcile) {
        void loadReconcilerNames(tenantId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load collections';
      setLoadError(message);
      toastError(message, 'Could not load collections');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    if (!canRecord) return;
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      vehicleId: isDriver ? vehicleId || '' : '',
      driverId: isDriver ? driverId || '' : '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (collection: Collection) => {
    if (isDriver) return;
    setEditing(collection);
    setForm({
      vehicleId: collection.vehicle_id,
      driverId: collection.driver_id,
      amount: collection.amount.toString(),
      paymentMethod: collection.payment_method,
      mpesaReceipt: collection.mpesa_receipt || '',
      date: collection.date,
      shift: collection.shift || 'morning',
      notes: collection.notes || '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (!tenantId) throw new Error('No fleet found for this account.');
      if (isDriver && editing) throw new Error('Drivers cannot edit recorded collections.');
      if (!canRecord) throw new Error('Ask your fleet owner to link your driver record and current vehicle first.');
      const selectedVehicleId = requireUuid(isDriver ? vehicleId : form.vehicleId, 'vehicle');
      const selectedDriverId = requireUuid(isDriver ? driverId : form.driverId, 'driver');
      const amount = Number.parseFloat(form.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid amount');
      if (!form.date) throw new Error('Choose the collection date');

      const nextReceipt = normalizeCollectionReceipt(form.paymentMethod, form.mpesaReceipt);
      const resetFields = editing
        ? reconciliationFieldsForEdit(editing, {
            amount,
            payment_method: form.paymentMethod,
            mpesa_receipt: nextReceipt,
          })
        : {};
      const resetOccurred = Boolean(
        editing &&
          shouldResetReconciliationOnEdit(editing, {
            amount,
            payment_method: form.paymentMethod,
            mpesa_receipt: nextReceipt,
          }),
      );

      const basePayload = {
        tenant_id: tenantId,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        amount,
        payment_method: form.paymentMethod,
        mpesa_receipt: nextReceipt,
        date: form.date,
        shift: form.shift,
        notes: optionalNotes(form.notes),
      };

      const result = editing
        ? await supabase
            .from('collections')
            .update({ ...basePayload, ...resetFields })
            .eq('id', editing.id)
            .eq('tenant_id', tenantId)
            .select(COLLECTION_SELECT)
        : await supabase
            .from('collections')
            .insert([withRecordedBy(basePayload, userId)])
            .select(COLLECTION_SELECT);

      const savedRow = assertMutationRow(
        result,
        editing ? 'Could not update the collection' : 'Could not record the collection',
      ) as Collection;

      if (editing) {
        setCollections((previous) =>
          previous.map((item) => (item.id === savedRow.id ? savedRow : item)),
        );
        if (!isPendingReconcilableCollection(savedRow)) {
          setSelectedIds((previous) => {
            if (!previous.has(savedRow.id)) return previous;
            const next = new Set(previous);
            next.delete(savedRow.id);
            return next;
          });
        }
        toastSuccess(
          resetOccurred
            ? 'Collection updated and reset to Pending so it can be verified again.'
            : 'Collection updated.',
          'Saved',
        );
      } else {
        setCollections((previous) => [savedRow, ...previous]);
        toastSuccess('Collection recorded.', 'Saved');
      }

      setDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the collection';
      setFormError(message);
      toastError(message, 'Could not save the collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (collection: Collection) => {
    if (isDriver || !tenantId) return;
    if (!window.confirm('Delete this collection record? This cannot be undone.')) return;
    try {
      const result = await supabase
        .from('collections')
        .delete()
        .eq('id', collection.id)
        .eq('tenant_id', tenantId)
        .select('id');
      assertMutation(result, 'Could not delete the collection');
      setCollections((previous) => previous.filter((item) => item.id !== collection.id));
      setSelectedIds((previous) => {
        if (!previous.has(collection.id)) return previous;
        const next = new Set(previous);
        next.delete(collection.id);
        return next;
      });
      toastSuccess('Collection deleted.', 'Deleted');
    } catch (err) {
      toastError(err, 'Could not delete the collection');
    }
  };

  const handleReconcileIds = async (ids: string[]) => {
    if (!canReconcile || !tenantId || ids.length === 0) return;

    setReconcilingIds((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => next.add(id));
      return next;
    });

    try {
      const response = await fetch('/api/collections/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          action: 'reconcile',
          ids,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        rows?: ReconcileApiRow[];
        reconcilerName?: string | null;
      };
      if (!response.ok || !payload.rows || payload.rows.length === 0) {
        throw new Error(payload.error || 'Could not mark collection reconciled');
      }

      const first = payload.rows[0];
      const updatedIdList = payload.rows.map((row) => row.id);

      setCollections((previous) =>
        applyReconciliationToCollections(previous, updatedIdList, {
          reconciled: true,
          reconciled_at: first.reconciled_at,
          reconciled_by: first.reconciled_by,
        }),
      );

      if (first.reconciled_by && payload.reconcilerName) {
        const verifiedBy = first.reconciled_by;
        const verifiedName = payload.reconcilerName;
        setReconcilerNames((previous) => ({ ...previous, [verifiedBy]: verifiedName }));
      }

      setSelectedIds((previous) => {
        const next = new Set(previous);
        updatedIdList.forEach((id) => next.delete(id));
        return next;
      });

      toastSuccess(
        updatedIdList.length === 1
          ? 'Collection marked reconciled.'
          : `${updatedIdList.length} collections marked reconciled.`,
        'Reconciled',
      );
    } catch (err) {
      toastError(err, 'Could not reconcile collections');
    } finally {
      setReconcilingIds((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const handleConfirmUnreconcile = async () => {
    if (!canReconcile || !tenantId || !unreconcileTarget) return;
    const targetId = unreconcileTarget.id;
    setUnreconciling(true);

    try {
      const response = await fetch('/api/collections/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          action: 'unreconcile',
          ids: [targetId],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        rows?: ReconcileApiRow[];
      };
      if (!response.ok || !payload.rows || payload.rows.length === 0) {
        throw new Error(payload.error || 'Could not unreconcile collection');
      }

      setCollections((previous) =>
        applyReconciliationToCollections(previous, [targetId], {
          reconciled: false,
          reconciled_at: null,
          reconciled_by: null,
        }),
      );
      setUnreconcileTarget(null);
      toastSuccess('Collection returned to Pending.', 'Unreconciled');
    } catch (err) {
      toastError(err, 'Could not unreconcile collection');
    } finally {
      setUnreconciling(false);
    }
  };

  const filteredCollections = useMemo(
    () =>
      collections.filter((collection) => {
        if (searchDate && !collection.date.startsWith(searchDate)) return false;
        if (filterMethod !== 'all' && collection.payment_method !== filterMethod) return false;
        if (filterStatus !== 'all' && collectionStatus(collection) !== filterStatus) return false;
        return true;
      }),
    [collections, searchDate, filterMethod, filterStatus],
  );

  const visiblePendingCollections = useMemo(
    () => filteredCollections.filter((collection) => isPendingReconcilableCollection(collection)),
    [filteredCollections],
  );

  const selectedPendingIds = useMemo(
    () => pruneSelectedPendingIds(selectedIds, filteredCollections),
    [selectedIds, filteredCollections],
  );

  const selectedPendingTotal = useMemo(() => {
    if (selectedPendingIds.length === 0) return 0;
    const activeSet = new Set(selectedPendingIds);
    return visiblePendingCollections
      .filter((collection) => activeSet.has(collection.id))
      .reduce((sum, collection) => sum + collection.amount, 0);
  }, [selectedPendingIds, visiblePendingCollections]);

  const allVisiblePendingSelected =
    visiblePendingCollections.length > 0 &&
    selectedPendingIds.length === visiblePendingCollections.length;

  const bulkSubmitting = selectedPendingIds.some((id) => reconcilingIds.has(id));

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllVisiblePending = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const row of visiblePendingCollections) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const totalCollections = filteredCollections.reduce((sum, collection) => sum + collection.amount, 0);
  const reconciliation = reconciliationStats(filteredCollections);
  const isLoading = loading || accessLoading;

  const parsedFormAmount = Number.parseFloat(form.amount);
  const formWillResetReconciliation = Boolean(
    editing &&
      isReconciledElectronicCollection(editing) &&
      shouldResetReconciliationOnEdit(editing, {
        amount: Number.isFinite(parsedFormAmount) ? parsedFormAmount : Number.NaN,
        payment_method: form.paymentMethod,
        mpesa_receipt: normalizeCollectionReceipt(form.paymentMethod, form.mpesaReceipt),
      }),
  );

  return (
    <PageShell
      loading={isLoading}
      title={isDriver ? 'My collections' : 'Collections'}
      description={
        isDriver
          ? 'Record your daily collections for your assigned vehicle.'
          : 'Track daily revenue from cash, M-Pesa, and Pochi, and verify receipt codes against your M-Pesa statement.'
      }
      actions={
        <Button type="button" className="min-h-11" onClick={openCreate} disabled={!canRecord}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Record collection
        </Button>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {isDriver && accessError && <DriverScopeNotice message={accessError} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          loading={isLoading}
          title="Total collections"
          value={`KES ${totalCollections.toLocaleString()}`}
          description={`${filteredCollections.length} records`}
          Icon={Wallet}
        />
        <StatCard
          loading={isLoading}
          title="Average collection"
          value={`KES ${filteredCollections.length > 0 ? Math.round(totalCollections / filteredCollections.length).toLocaleString() : 0}`}
          description="Per transaction"
          Icon={TrendingUp}
        />
        <StatCard
          loading={isLoading}
          title="Reconciliation rate"
          value={`${reconciliation.rate}%`}
          description={
            reconciliation.electronicCount > 0
              ? `${reconciliation.reconciled} of ${reconciliation.electronicCount} M-Pesa & Pochi`
              : 'No M-Pesa or Pochi records'
          }
          Icon={BadgeCheck}
        />
      </div>

      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Narrow the list by date, payment method, or verification status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="collection-date-filter">Date</Label>
                <Input
                  id="collection-date-filter"
                  type="date"
                  value={searchDate}
                  onChange={(event) => setSearchDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-method-filter">Payment method</Label>
                <NativeSelect
                  id="collection-method-filter"
                  value={filterMethod}
                  onChange={(event) => setFilterMethod(event.target.value as 'all' | PaymentMethod)}
                >
                  <option value="all">All methods</option>
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="pochi">Pochi</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-status-filter">Status</Label>
                <NativeSelect
                  id="collection-status-filter"
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Reconciled">Reconciled</option>
                  <option value="Recorded">Recorded (Cash)</option>
                </NativeSelect>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setSearchDate('');
                  setFilterMethod('all');
                  setFilterStatus('all');
                }}
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Collection records</CardTitle>
          <CardDescription>
            {isLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : canReconcile && reconciliation.pending > 0 ? (
              `${filteredCollections.length} records found · ${reconciliation.pending} pending statement check`
            ) : (
              `${filteredCollections.length} records found`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8" role="status" aria-label="Loading collections">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="sr-only">Loading collections…</span>
            </div>
          ) : loadError ? (
            <LoadFailure label="collections" message={loadError} onRetry={fetchData} />
          ) : filteredCollections.length === 0 ? (
            <EmptyState
              title={collections.length === 0 ? 'No collections yet' : 'No records match these filters'}
              description={
                collections.length === 0
                  ? 'Record the first collection for a vehicle and driver.'
                  : 'Clear the filters or pick another date.'
              }
              action={
                collections.length === 0 && canRecord ? (
                  <Button type="button" onClick={openCreate}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Record collection
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {canReconcile && visiblePendingCollections.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 md:hidden">
                    <label
                      htmlFor="mobile-select-all-pending"
                      className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium"
                    >
                      <Checkbox
                        id="mobile-select-all-pending"
                        checked={allVisiblePendingSelected}
                        disabled={bulkSubmitting}
                        onCheckedChange={(checked) => toggleSelectAllVisiblePending(checked === true)}
                      />
                      <span>Select all pending ({visiblePendingCollections.length})</span>
                    </label>
                  </div>

                  {selectedPendingIds.length > 0 && (
                    <div
                      role="region"
                      aria-label="Bulk reconciliation actions"
                      className="flex flex-col gap-2.5 rounded-xl border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-sm font-medium">
                        {selectedPendingIds.length} pending selected · KES{' '}
                        {selectedPendingTotal.toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 flex-1 sm:flex-initial"
                          disabled={bulkSubmitting}
                          onClick={clearSelection}
                        >
                          Clear
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11 flex-1 sm:flex-initial"
                          disabled={bulkSubmitting}
                          onClick={() => void handleReconcileIds(selectedPendingIds)}
                        >
                          {bulkSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <BadgeCheck className="mr-2 h-4 w-4" />
                          )}
                          Reconcile selected ({selectedPendingIds.length})
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-3 md:hidden">
                {filteredCollections.map((collection) => {
                  const status = collectionStatus(collection);
                  const isPending = isPendingReconcilableCollection(collection);
                  const isReconciled = isReconciledElectronicCollection(collection);
                  const isElectronic = isElectronicCollectionMethod(collection.payment_method);
                  const isSelected = isPending && selectedIds.has(collection.id);
                  const isRowBusy = reconcilingIds.has(collection.id);
                  const reconciledDetails = formatReconciledDetails(collection, {
                    currentUserId: userId,
                    reconcilerNames,
                  });

                  return (
                    <article
                      key={collection.id}
                      className={cn(
                        'rounded-2xl border bg-card p-4 shadow-sm transition-colors',
                        isSelected && 'border-primary/60 bg-primary/5',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {canReconcile && isPending && (
                            <Checkbox
                              checked={isSelected}
                              disabled={isRowBusy}
                              onCheckedChange={(checked) => toggleSelectRow(collection.id, checked === true)}
                              aria-label={`Select pending ${methodLabel(collection.payment_method)} collection of KES ${collection.amount.toLocaleString()}`}
                              className="mt-1 h-5 w-5"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {collection.vehicles?.registration_number || 'Vehicle removed'}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {collection.drivers?.full_name || 'Driver removed'} · {formatDateOnly(collection.date)}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 font-semibold">KES {collection.amount.toLocaleString()}</p>
                      </div>

                      {isElectronic && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Receipt:{' '}
                          {collection.mpesa_receipt ? (
                            <span className="font-mono font-medium text-foreground">
                              {collection.mpesa_receipt}
                            </span>
                          ) : (
                            <span>Not recorded</span>
                          )}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <RecordOriginBadge
                          recordedBy={collection.recorded_by}
                          driverUserId={collection.drivers?.user_id}
                        />
                        <Badge variant="secondary">{methodLabel(collection.payment_method)}</Badge>
                        <Badge variant="secondary" className="capitalize">
                          {collection.shift || '—'}
                        </Badge>
                        <Badge className={statusBadgeClass(status)}>{status}</Badge>
                      </div>

                      {reconciledDetails && (
                        <p className="mt-2 text-xs text-muted-foreground">{reconciledDetails}</p>
                      )}

                      {!isDriver && (
                        <div className="mt-3 space-y-2">
                          {canReconcile && isPending && (
                            <Button
                              type="button"
                              className="min-h-11 w-full"
                              disabled={isRowBusy}
                              onClick={() => void handleReconcileIds([collection.id])}
                            >
                              {isRowBusy ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="mr-2 h-4 w-4" />
                              )}
                              Mark reconciled
                            </Button>
                          )}
                          <div className="flex gap-2">
                            {canReconcile && isReconciled && (
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 flex-1"
                                disabled={isRowBusy || unreconciling}
                                onClick={() => setUnreconcileTarget(collection)}
                              >
                                Unreconcile
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 flex-1"
                              disabled={isRowBusy}
                              onClick={() => openEdit(collection)}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 text-destructive"
                              disabled={isRowBusy}
                              onClick={() => void handleDelete(collection)}
                              aria-label="Delete collection"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <TableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canReconcile && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allVisiblePendingSelected}
                            disabled={visiblePendingCollections.length === 0 || bulkSubmitting}
                            onCheckedChange={(checked) => toggleSelectAllVisiblePending(checked === true)}
                            aria-label="Select all pending collections"
                          />
                        </TableHead>
                      )}
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entry</TableHead>
                      {!isDriver && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCollections.map((collection) => {
                      const status = collectionStatus(collection);
                      const isPending = isPendingReconcilableCollection(collection);
                      const isReconciled = isReconciledElectronicCollection(collection);
                      const isElectronic = isElectronicCollectionMethod(collection.payment_method);
                      const isSelected = isPending && selectedIds.has(collection.id);
                      const isRowBusy = reconcilingIds.has(collection.id);
                      const reconciledDetails = formatReconciledDetails(collection, {
                        currentUserId: userId,
                        reconcilerNames,
                      });

                      return (
                        <TableRow
                          key={collection.id}
                          className={cn(isSelected && 'bg-primary/5')}
                        >
                          {canReconcile && (
                            <TableCell>
                              {isPending ? (
                                <Checkbox
                                  checked={isSelected}
                                  disabled={isRowBusy}
                                  onCheckedChange={(checked) => toggleSelectRow(collection.id, checked === true)}
                                  aria-label={`Select pending ${methodLabel(collection.payment_method)} collection of KES ${collection.amount.toLocaleString()}`}
                                />
                              ) : null}
                            </TableCell>
                          )}
                          <TableCell className="whitespace-nowrap">{formatDateOnly(collection.date)}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            {collection.vehicles?.registration_number || '—'}
                          </TableCell>
                          <TableCell>{collection.drivers?.full_name || '—'}</TableCell>
                          <TableCell className="font-semibold whitespace-nowrap">
                            KES {collection.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div>{methodLabel(collection.payment_method)}</div>
                            {isElectronic && (
                              <div className="font-mono text-xs text-muted-foreground">
                                {collection.mpesa_receipt || 'No receipt'}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{collection.shift || '—'}</TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(status)}>{status}</Badge>
                            {reconciledDetails && (
                              <p className="mt-1 text-xs text-muted-foreground">{reconciledDetails}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <RecordOriginBadge
                              recordedBy={collection.recorded_by}
                              driverUserId={collection.drivers?.user_id}
                            />
                          </TableCell>
                          {!isDriver && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {canReconcile && isPending && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11 whitespace-nowrap"
                                    disabled={isRowBusy}
                                    onClick={() => void handleReconcileIds([collection.id])}
                                  >
                                    {isRowBusy ? (
                                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="mr-1.5 h-4 w-4" />
                                    )}
                                    Mark reconciled
                                  </Button>
                                )}
                                {canReconcile && isReconciled && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="min-h-11 whitespace-nowrap text-muted-foreground hover:text-foreground"
                                    disabled={isRowBusy || unreconciling}
                                    onClick={() => setUnreconcileTarget(collection)}
                                  >
                                    Unreconcile
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-11"
                                  disabled={isRowBusy}
                                  onClick={() => openEdit(collection)}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit collection</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-11 text-destructive"
                                  disabled={isRowBusy}
                                  onClick={() => void handleDelete(collection)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete collection</span>
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableScroll>
            </>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit collection' : 'Record collection'}
        description={
          isDriver
            ? 'Your name and current vehicle are filled in for you.'
            : 'Collections are the revenue side of your fleet P&L.'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDriver ? (
            <>
              <LockedValue
                id="collection_vehicle_locked"
                label="Vehicle"
                value={vehicleLabel || 'No vehicle assigned'}
                hint="Set by your fleet owner."
              />
              <LockedValue
                id="collection_driver_locked"
                label="Driver"
                value={driverName || 'Your driver record'}
                hint="You can only record your own collections."
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="collection_vehicle">Vehicle *</Label>
                <NativeSelect
                  id="collection_vehicle"
                  value={form.vehicleId}
                  onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}
                  required
                  disabled={submitting}
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="collection_driver">Driver *</Label>
                <NativeSelect
                  id="collection_driver"
                  value={form.driverId}
                  onChange={(event) => setForm({ ...form, driverId: event.target.value })}
                  required
                  disabled={submitting}
                >
                  <option value="">Select driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="collection_amount">Amount (KES) *</Label>
            <Input
              id="collection_amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="0.00"
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection_method">Payment method *</Label>
            <NativeSelect
              id="collection_method"
              value={form.paymentMethod}
              onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}
              required
              disabled={submitting}
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="pochi">Pochi</option>
            </NativeSelect>
          </div>

          {isElectronicCollectionMethod(form.paymentMethod) && (
            <div className="space-y-2">
              <Label htmlFor="mpesa_receipt">
                {form.paymentMethod === 'pochi'
                  ? 'Pochi / M-Pesa receipt code'
                  : 'M-Pesa receipt / transaction code'}
              </Label>
              <Input
                id="mpesa_receipt"
                value={form.mpesaReceipt}
                onChange={(event) => setForm({ ...form, mpesaReceipt: event.target.value })}
                placeholder="e.g., ABCDEF123456"
                disabled={submitting}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="collection_date">Date *</Label>
              <Input
                id="collection_date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection_shift">Shift *</Label>
              <NativeSelect
                id="collection_shift"
                value={form.shift}
                onChange={(event) => setForm({ ...form, shift: event.target.value as Shift })}
                required
                disabled={submitting}
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection_notes">Notes (optional)</Label>
            <Textarea
              id="collection_notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Anything worth noting about this collection…"
              rows={3}
              disabled={submitting}
            />
          </div>

          {formWillResetReconciliation && (
            <Alert>
              <AlertDescription>
                Saving a changed amount, receipt code, or cash payment method will reset this collection to Pending so it can be verified again.
              </AlertDescription>
            </Alert>
          )}

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                'Update collection'
              ) : (
                'Record collection'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>

      <AlertDialog
        open={Boolean(unreconcileTarget)}
        onOpenChange={(open) => {
          if (!open && !unreconciling) setUnreconcileTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Unreconcile this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              {unreconcileTarget ? (
                <>
                  This will return the {methodLabel(unreconcileTarget.payment_method)} collection of{' '}
                  <span className="font-medium text-foreground">
                    KES {unreconcileTarget.amount.toLocaleString()}
                  </span>
                  {unreconcileTarget.vehicles?.registration_number
                    ? ` for ${unreconcileTarget.vehicles.registration_number}`
                    : ''}
                  {unreconcileTarget.mpesa_receipt
                    ? ` (receipt ${unreconcileTarget.mpesa_receipt})`
                    : ''}{' '}
                  back to Pending and clear its verification stamp.
                </>
              ) : (
                'This will return the collection to Pending and clear its verification stamp.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={unreconciling}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={unreconciling}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmUnreconcile();
              }}
            >
              {unreconciling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unreconciling…
                </>
              ) : (
                'Yes, unreconcile'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
