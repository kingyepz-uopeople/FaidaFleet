'use client';
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Loader2, Trash, Edit } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { NativeSelect } from '@/components/native-select';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type TripRow = Database['public']['Tables']['trips']['Row'] & {
  vehicles: { registration_number: string } | null;
  drivers: { full_name: string } | null;
};

type OptionRow = { id: string; registration_number?: string; full_name?: string };

const EMPTY_FORM = {
  vehicleId: '',
  driverId: '',
  tripDate: new Date().toISOString().split('T')[0],
  distanceKm: '',
  earnings: '',
  expenses: '',
  startLocation: '',
  endLocation: '',
};

export default function TripsPage() {
  const { tenantId, userId, loading: tenantLoading, error: tenantError } = useActiveTenant();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [vehicles, setVehicles] = useState<OptionRow[]>([]);
  const [drivers, setDrivers] = useState<OptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TripRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<TripRow | null>(null);
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

      const [tripsRes, vehiclesRes, driversRes] = await Promise.all([
        supabase
          .from('trips')
          .select('*, vehicles(registration_number), drivers(full_name)')
          .eq('tenant_id', tId)
          .order('trip_date', { ascending: false }),
        supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tId).eq('is_active', true),
        supabase.from('drivers').select('id, full_name').eq('tenant_id', tId).eq('is_active', true),
      ]);

      if (tripsRes.error) throw tripsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setTrips((tripsRes.data as unknown as TripRow[]) || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load trips.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (trip?: TripRow) => {
    if (trip) {
      setEditing(trip);
      setForm({
        vehicleId: trip.vehicle_id,
        driverId: trip.driver_id,
        tripDate: trip.trip_date,
        distanceKm: trip.distance_km?.toString() || '',
        earnings: trip.earnings?.toString() || '',
        expenses: trip.expenses?.toString() || '',
        startLocation: trip.start_location || '',
        endLocation: trip.end_location || '',
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
      toast({ title: 'No active fleet', description: tenantError || 'Set up your fleet before recording trips.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      assertUuid(form.vehicleId, 'Vehicle');
      assertUuid(form.driverId, 'Driver');
      const payload = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId,
        driver_id: form.driverId,
        trip_date: form.tripDate,
        distance_km: form.distanceKm ? parseFloat(form.distanceKm) : null,
        earnings: parseFloat(form.earnings) || 0,
        expenses: parseFloat(form.expenses) || 0,
        start_location: form.startLocation || null,
        end_location: form.endLocation || null,
      };
      if (editing) {
        assertUuid(editing.id, 'Trip');
        await requireRows(
          supabase.from('trips').update(payload).eq('id', editing.id).select('id'),
          'trip',
          'update',
        );
        toast({ title: 'Trip updated', description: 'The trip record was saved.' });
      } else {
        await requireRows(
          supabase
            .from('trips')
            .insert([{ ...payload, recorded_by: userId }])
            .select('id'),
          'trip',
          'create',
        );
        toast({ title: 'Trip recorded', description: 'The new trip was saved to your ledger.' });
      }
      setOpen(false);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: editing ? 'Could not update trip' : 'Could not record trip',
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
      assertUuid(deleteTarget.id, 'Trip');
      await requireRows(
        supabase.from('trips').delete().eq('id', deleteTarget.id).select('id'),
        'trip',
        'delete',
      );
      toast({ title: 'Trip deleted', description: 'The trip record was removed.' });
      setDeleteTarget(null);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: 'Could not delete trip',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalEarnings = trips.reduce((sum, t) => sum + Number(t.earnings || 0), 0);
  const totalExpenses = trips.reduce((sum, t) => sum + Number(t.expenses || 0), 0);
  const totalProfit = totalEarnings - totalExpenses;
  const pageBlocked = !tenantLoading && !tenantId;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Trips &amp; Routes</h1>
          <p className="text-gray-600 dark:text-gray-400">Track individual trips and earnings</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="mr-2 h-4 w-4" />Record Trip
        </Button>
      </div>

      {(loadError || tenantError) && (
        <Alert variant="destructive">
          <AlertDescription>{loadError || tenantError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-lg">Total Earnings</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">KES {totalEarnings.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Total Expenses</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Net Profit</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalProfit.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Trip Records</CardTitle><CardDescription>{trips.length} trips recorded</CardDescription></CardHeader>
        <CardContent>
          {loading || tenantLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : trips.length === 0 ? (
            <div className="py-8 text-center text-gray-500"><p>No trips recorded yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Expenses</TableHead>
                    <TableHead>Profit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>{format(new Date(trip.trip_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{trip.vehicles?.registration_number || '—'}</TableCell>
                      <TableCell>{trip.drivers?.full_name || '—'}</TableCell>
                      <TableCell>{trip.distance_km ? `${trip.distance_km.toFixed(1)} km` : '—'}</TableCell>
                      <TableCell className="font-bold text-green-600">KES {Number(trip.earnings || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-red-600">KES {Number(trip.expenses || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-bold text-blue-600">KES {(Number(trip.earnings || 0) - Number(trip.expenses || 0)).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" aria-label="Edit trip" onClick={() => handleOpenDialog(trip)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" aria-label="Delete trip" onClick={() => setDeleteTarget(trip)}><Trash className="h-4 w-4 text-red-600" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Trip' : 'Record Trip'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Vehicle *</Label>
              <NativeSelect value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
                <option value="" disabled>Select vehicle</option>
                {vehicles.map((v) => (<option key={v.id} value={v.id}>{v.registration_number}</option>))}
              </NativeSelect>
            </div>
            <div>
              <Label>Driver *</Label>
              <NativeSelect value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required>
                <option value="" disabled>Select driver</option>
                {drivers.map((d) => (<option key={d.id} value={d.id}>{d.full_name}</option>))}
              </NativeSelect>
            </div>
            <div><Label>Trip Date *</Label><Input type="date" value={form.tripDate} onChange={(e) => setForm({ ...form, tripDate: e.target.value })} required /></div>
            <div><Label>Distance (KM)</Label><Input type="number" step="0.01" inputMode="decimal" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })} placeholder="0.00" /></div>
            <div><Label>Earnings (KES) *</Label><Input type="number" step="0.01" inputMode="decimal" value={form.earnings} onChange={(e) => setForm({ ...form, earnings: e.target.value })} placeholder="0.00" required /></div>
            <div><Label>Expenses (KES)</Label><Input type="number" step="0.01" inputMode="decimal" value={form.expenses} onChange={(e) => setForm({ ...form, expenses: e.target.value })} placeholder="0.00" /></div>
            <div><Label>Start Location</Label><Input value={form.startLocation} onChange={(e) => setForm({ ...form, startLocation: e.target.value })} placeholder="e.g. Nairobi CBD" /></div>
            <div><Label>End Location</Label><Input value={form.endLocation} onChange={(e) => setForm({ ...form, endLocation: e.target.value })} placeholder="e.g. Westlands" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600">{submitting ? 'Saving…' : editing ? 'Update' : 'Record'}</Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete trip?"
        description="This trip record will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
