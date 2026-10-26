'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDateOnly } from '@/lib/dates';
import { collectionStatus } from '@/lib/fleet-metrics';
import { NativeSelect } from '@/components/native-select';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type CollectionRow = Database['public']['Tables']['collections']['Row'] & {
  vehicles: { registration_number: string } | null;
  drivers: { full_name: string } | null;
};

type CollectionInsert = Database['public']['Tables']['collections']['Insert'];
type PaymentMethod = NonNullable<CollectionInsert['payment_method']>;
type Shift = NonNullable<CollectionInsert['shift']>;

type CollectionForm = {
  vehicleId: string;
  driverId: string;
  amount: string;
  paymentMethod: PaymentMethod;
  mpesaReceipt: string;
  date: string;
  shift: Shift;
};

type VehicleOption = { id: string; registration_number: string };
type DriverOption = { id: string; full_name: string };

const EMPTY_FORM: CollectionForm = {
  vehicleId: '',
  driverId: '',
  amount: '',
  paymentMethod: 'cash',
  mpesaReceipt: '',
  date: new Date().toISOString().split('T')[0],
  shift: 'morning',
};

export default function CollectionsPage() {
  const { tenantId, userId, loading: tenantLoading, error: tenantError } = useActiveTenant();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchDate, setSearchDate] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<CollectionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    if (!tenantId) return;
    void fetchData(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchData = async (tId: string) => {
    try {
      setLoading(true);
      setLoadError(null);

      const [collectionsRes, vehiclesRes, driversRes] = await Promise.all([
        supabase
          .from('collections')
          .select('*, vehicles(registration_number), drivers(full_name)')
          .eq('tenant_id', tId)
          .order('date', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', tId)
          .eq('is_active', true),
        supabase
          .from('drivers')
          .select('id, full_name')
          .eq('tenant_id', tId)
          .eq('is_active', true),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setCollections((collectionsRes.data as unknown as CollectionRow[]) || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load collections.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (collection?: CollectionRow) => {
    if (collection) {
      setEditing(collection);
      setForm({
        vehicleId: collection.vehicle_id,
        driverId: collection.driver_id,
        amount: collection.amount.toString(),
        paymentMethod: collection.payment_method,
        mpesaReceipt: collection.mpesa_receipt || '',
        date: collection.date,
        shift: collection.shift || 'morning',
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      toast({ title: 'No active fleet', description: tenantError || 'Set up your fleet before recording collections.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    try {
      assertUuid(form.vehicleId, 'Vehicle');
      assertUuid(form.driverId, 'Driver');
      if (!form.amount || parseFloat(form.amount) <= 0) {
        throw new Error('Enter an amount greater than zero.');
      }

      const payload = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId,
        driver_id: form.driverId,
        amount: parseFloat(form.amount),
        payment_method: form.paymentMethod,
        mpesa_receipt: form.paymentMethod === 'mpesa' ? form.mpesaReceipt.trim() || null : null,
        date: form.date,
        shift: form.shift,
      };

      if (editing) {
        assertUuid(editing.id, 'Collection');
        await requireRows(
          supabase.from('collections').update(payload).eq('id', editing.id).select('id'),
          'collection',
          'update',
        );
        toast({ title: 'Collection updated', description: 'The record was saved.' });
      } else {
        await requireRows(
          supabase
            .from('collections')
            .insert([{ ...payload, recorded_by: userId }])
            .select('id'),
          'collection',
          'create',
        );
        toast({ title: 'Collection recorded', description: 'The new collection is in your ledger.' });
      }

      setOpen(false);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: editing ? 'Could not update collection' : 'Could not record collection',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return;
    setDeleting(true);
    try {
      assertUuid(deleteTarget.id, 'Collection');
      await requireRows(
        supabase.from('collections').delete().eq('id', deleteTarget.id).select('id'),
        'collection',
        'delete',
      );
      toast({ title: 'Collection deleted', description: 'The record was removed.' });
      setDeleteTarget(null);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: 'Could not delete collection',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'mpesa':
        return 'bg-green-100 text-green-800';
      case 'cash':
        return 'bg-blue-100 text-blue-800';
      case 'pochi':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredCollections = collections.filter((c) => {
    if (searchDate && !c.date.startsWith(searchDate)) return false;
    if (filterMethod !== 'all' && c.payment_method !== filterMethod) return false;
    return true;
  });

  const totalCollections = filteredCollections.reduce((sum, c) => sum + Number(c.amount), 0);
  const reconciliationRate = filteredCollections.length > 0
    ? Math.round((filteredCollections.filter((c) => c.reconciled).length / filteredCollections.length) * 100)
    : 0;
  const pageBlocked = !tenantLoading && !tenantId;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="text-gray-600 dark:text-gray-400">Track daily revenue and collections</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="mr-2 h-4 w-4" />
          Record Collection
        </Button>
      </div>

      {(loadError || tenantError) && (
        <Alert variant="destructive">
          <AlertDescription>{loadError || tenantError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">KES {totalCollections.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{filteredCollections.length} records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {filteredCollections.length > 0 ? Math.round(totalCollections / filteredCollections.length) : 0}</p>
            <p className="text-sm text-gray-500">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reconciliation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{reconciliationRate}%</p>
            <p className="text-sm text-gray-500">Verified transactions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[9rem] flex-1">
            <Label className="text-sm">Date</Label>
            <Input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="min-w-[9rem] flex-1">
            <Label className="text-sm">Payment Method</Label>
            <NativeSelect value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="mt-1">
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="pochi">Pochi</option>
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => { setSearchDate(''); setFilterMethod('all'); }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collection Records</CardTitle>
          <CardDescription>{filteredCollections.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || tenantLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No collection records found</p>
              <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Record First Collection
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollections.map((collection) => (
                    <TableRow key={collection.id}>
                      <TableCell>{formatDateOnly(collection.date)}</TableCell>
                      <TableCell className="font-medium">{collection.vehicles?.registration_number || '—'}</TableCell>
                      <TableCell>{collection.drivers?.full_name || '—'}</TableCell>
                      <TableCell className="font-bold">KES {Number(collection.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getPaymentMethodColor(collection.payment_method)}>
                          {collection.payment_method.charAt(0).toUpperCase() + collection.payment_method.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{collection.shift || '—'}</TableCell>
                      <TableCell>
                        <Badge className={collectionStatus(collection) === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                          {collectionStatus(collection)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" aria-label="Edit collection" onClick={() => handleOpenDialog(collection)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label="Delete collection" onClick={() => setDeleteTarget(collection)}>
                            <Trash className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SafeDialog open={open} onOpenChange={setOpen}>
        <SafeDialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Collection' : 'Record Collection'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Vehicle *</Label>
              <NativeSelect value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
                <option value="" disabled>Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration_number}</option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label>Driver *</Label>
              <NativeSelect value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required>
                <option value="" disabled>Select driver</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label>Amount (KES) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label>Payment Method *</Label>
              <NativeSelect value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="pochi">Pochi</option>
              </NativeSelect>
            </div>

            {form.paymentMethod === 'mpesa' && (
              <div>
                <Label>M-Pesa Receipt/Transaction Code</Label>
                <Input
                  value={form.mpesaReceipt}
                  onChange={(e) => setForm({ ...form, mpesaReceipt: e.target.value })}
                  placeholder="e.g., ABCDEF123456"
                />
              </div>
            )}

            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Shift *</Label>
              <NativeSelect value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value as Shift })}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </NativeSelect>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600">
                {submitting ? 'Saving…' : editing ? 'Update' : 'Record'}
              </Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete collection?"
        description="This collection record will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
