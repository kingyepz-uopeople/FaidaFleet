'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Trash2, Edit, Wallet, TrendingUp, BadgeCheck } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { optionalNotes, withRecordedBy } from '@/lib/record-payload';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { collectionStatus } from '@/lib/fleet-metrics';
import { EmptyState, LoadFailure, PageShell, TableScroll } from '@/components/page-shell';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { StatCard } from '@/components/stat-card';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { DriverScopeNotice, LockedValue } from '@/components/driver-scope';
import { RecordOriginBadge } from '@/components/record-origin-badge';

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';

type PaymentMethod = 'cash' | 'mpesa' | 'pochi';
type Shift = 'morning' | 'afternoon' | 'evening' | 'night';

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
  notes: string | null;
  recorded_by: string | null;
  vehicles: { registration_number: string } | null;
  drivers: { full_name: string; user_id: string | null } | null;
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

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [drivers, setDrivers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchDate, setSearchDate] = useState('');
  const [filterMethod, setFilterMethod] = useState<'all' | PaymentMethod>('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    userId,
    tenantId,
    isDriver,
    driverId,
    driverName,
    vehicleId,
    vehicleLabel,
    loadError: accessError,
  } = useFleetAccess();
  const canRecord = !isDriver || Boolean(driverId && vehicleId);

  useEffect(() => {
    if (!accessLoading) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, tenantId, isDriver, driverId, vehicleId]);

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
              .select('*, vehicles(registration_number), drivers(full_name, user_id)')
              .eq('tenant_id', tenantId)
              .eq('driver_id', driverId || NO_MATCH_UUID)
          : supabase
              .from('collections')
              .select('*, vehicles(registration_number), drivers(full_name, user_id)')
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

      const payload = {
        tenant_id: tenantId,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        amount,
        payment_method: form.paymentMethod,
        mpesa_receipt: form.paymentMethod === 'mpesa' ? form.mpesaReceipt.trim() || null : null,
        date: form.date,
        shift: form.shift,
        notes: optionalNotes(form.notes),
      };

      const result = editing
        ? await supabase.from('collections').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('collections').insert([withRecordedBy(payload, userId)]).select('id');

      assertMutationRow(result, editing ? 'Could not update the collection' : 'Could not record the collection');
      toastSuccess(editing ? 'Collection updated.' : 'Collection recorded.', 'Saved');
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the collection';
      setFormError(message);
      toastError(message, 'Could not save the collection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (collection: Collection) => {
    if (isDriver) return;
    if (!window.confirm('Delete this collection record? This cannot be undone.')) return;
    try {
      const result = await supabase.from('collections').delete().eq('id', collection.id).select('id');
      assertMutation(result, 'Could not delete the collection');
      toastSuccess('Collection deleted.', 'Deleted');
      await fetchData();
    } catch (err) {
      toastError(err, 'Could not delete the collection');
    }
  };

  const filteredCollections = collections.filter((collection) => {
    if (searchDate && !collection.date.startsWith(searchDate)) return false;
    if (filterMethod !== 'all' && collection.payment_method !== filterMethod) return false;
    return true;
  });

  const totalCollections = filteredCollections.reduce((sum, collection) => sum + collection.amount, 0);
  const reconciliationRate = filteredCollections.length > 0
    ? Math.round((filteredCollections.filter((collection) => collection.reconciled).length / filteredCollections.length) * 100)
    : 0;
  const isLoading = loading || accessLoading;

  return (
    <PageShell
      loading={isLoading}
      title={isDriver ? 'My collections' : 'Collections'}
      description={isDriver ? 'Record your daily collections for your assigned vehicle.' : 'Track daily revenue from cash, M-Pesa, and Pochi.'}
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
        <StatCard loading={isLoading} title="Reconciliation rate" value={`${reconciliationRate}%`} description="Verified transactions" Icon={BadgeCheck} />
      </div>

      {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Narrow the list by date or payment method.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setSearchDate('');
                  setFilterMethod('all');
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
            {isLoading ? <Skeleton className="h-4 w-28" /> : `${filteredCollections.length} records found`}
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
              <div className="grid gap-3 md:hidden">
                {filteredCollections.map((collection) => {
                  const status = collectionStatus(collection);
                  return (
                    <article key={collection.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {collection.vehicles?.registration_number || 'Vehicle removed'}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {collection.drivers?.full_name || 'Driver removed'} · {formatDateOnly(collection.date)}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold">KES {collection.amount.toLocaleString()}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <RecordOriginBadge recordedBy={collection.recorded_by} driverUserId={collection.drivers?.user_id} />
                        <Badge variant="secondary">{methodLabel(collection.payment_method)}</Badge>
                        <Badge variant="secondary" className="capitalize">{collection.shift || '—'}</Badge>
                        <Badge className={status === 'Pending' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'}>
                          {status}
                        </Badge>
                      </div>
                      {!isDriver && (
                        <div className="mt-3 flex gap-2">
                          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => openEdit(collection)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 text-destructive"
                            onClick={() => handleDelete(collection)}
                            aria-label="Delete collection"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                      return (
                        <TableRow key={collection.id}>
                          <TableCell>{formatDateOnly(collection.date)}</TableCell>
                          <TableCell className="font-medium">{collection.vehicles?.registration_number || '—'}</TableCell>
                          <TableCell>{collection.drivers?.full_name || '—'}</TableCell>
                          <TableCell className="font-semibold">KES {collection.amount.toLocaleString()}</TableCell>
                          <TableCell>{methodLabel(collection.payment_method)}</TableCell>
                          <TableCell className="capitalize">{collection.shift || '—'}</TableCell>
                          <TableCell>
                            <Badge className={status === 'Pending' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell><RecordOriginBadge recordedBy={collection.recorded_by} driverUserId={collection.drivers?.user_id} /></TableCell>
                          {!isDriver && (
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => openEdit(collection)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit collection</span>
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="min-h-11 text-destructive" onClick={() => handleDelete(collection)}>
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
        description={isDriver ? 'Your name and current vehicle are filled in for you.' : 'Collections are the revenue side of your fleet P&L.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDriver ? (
            <>
              <LockedValue id="collection_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Set by your fleet owner." />
              <LockedValue id="collection_driver_locked" label="Driver" value={driverName || 'Your driver record'} hint="You can only record your own collections." />
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
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
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
                    <option key={driver.id} value={driver.id}>{driver.label}</option>
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

          {form.paymentMethod === 'mpesa' && (
            <div className="space-y-2">
              <Label htmlFor="mpesa_receipt">M-Pesa receipt / transaction code</Label>
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

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)} disabled={submitting}>
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
    </PageShell>
  );
}
