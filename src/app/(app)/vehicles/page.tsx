'use client';

import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit, AlertTriangle } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDateOnly, isDateBeforeToday } from '@/lib/dates';
import { vehicleComplianceStatus } from '@/lib/fleet-metrics';
import { NativeSelect } from '@/components/native-select';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle, Database } from '@/lib/database.types';

type VehicleType = NonNullable<Database['public']['Tables']['vehicles']['Insert']['vehicle_type']>;

type VehicleForm = {
  registration: string;
  make: string;
  model: string;
  year: string;
  capacity: string;
  vehicleType: VehicleType;
  insuranceExpiry: string;
  motExpiry: string;
};

const EMPTY_FORM: VehicleForm = {
  registration: '',
  make: '',
  model: '',
  year: new Date().getFullYear().toString(),
  capacity: '',
  vehicleType: 'psv',
  insuranceExpiry: '',
  motExpiry: '',
};

export default function VehiclesPage() {
  const { tenantId, loading: tenantLoading, error: tenantError } = useActiveTenant();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
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
      const { data, error: err } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tId)
        .order('registration_number');
      if (err) throw err;
      setVehicles(data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load vehicles.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditing(vehicle);
      setForm({
        registration: vehicle.registration_number,
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year?.toString() || new Date().getFullYear().toString(),
        capacity: vehicle.capacity?.toString() || '',
        vehicleType: vehicle.vehicle_type || 'psv',
        insuranceExpiry: vehicle.insurance_expiry || '',
        motExpiry: vehicle.mot_expiry || '',
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
      toast({ title: 'No active fleet', description: tenantError || 'Set up your fleet before adding vehicles.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        tenant_id: tenantId,
        registration_number: form.registration.trim().toUpperCase(),
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? parseInt(form.year, 10) : null,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        vehicle_type: form.vehicleType,
        insurance_expiry: form.insuranceExpiry || null,
        mot_expiry: form.motExpiry || null,
      };

      if (editing) {
        assertUuid(editing.id, 'Vehicle');
        await requireRows(
          supabase.from('vehicles').update(payload).eq('id', editing.id).select('id'),
          'vehicle',
          'update',
        );
        toast({ title: 'Vehicle updated', description: `${payload.registration_number} was saved.` });
      } else {
        await requireRows(
          supabase.from('vehicles').insert([{ ...payload, is_active: true }]).select('id'),
          'vehicle',
          'create',
        );
        toast({ title: 'Vehicle added', description: `${payload.registration_number} is now in your fleet.` });
      }
      setOpen(false);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: editing ? 'Could not update vehicle' : 'Could not add vehicle',
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
      assertUuid(deleteTarget.id, 'Vehicle');
      await requireRows(
        supabase.from('vehicles').delete().eq('id', deleteTarget.id).select('id'),
        'vehicle',
        'delete',
      );
      toast({ title: 'Vehicle deleted', description: `${deleteTarget.registration_number} was removed.` });
      setDeleteTarget(null);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: 'Could not delete vehicle',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const isExpired = (date: string | null) => Boolean(date && isDateBeforeToday(date));
  const getStatus = (v: Vehicle) => vehicleComplianceStatus(v);

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.is_active).length;
  const complianceIssues = vehicles.filter((v) => getStatus(v) !== 'Active').length;
  const pageBlocked = !tenantLoading && !tenantId;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Vehicles</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage fleet vehicles and compliance</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="mr-2 h-4 w-4" />Add Vehicle
        </Button>
      </div>

      {(loadError || tenantError) && (
        <Alert variant="destructive">
          <AlertDescription>{loadError || tenantError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-lg">Total Vehicles</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">{totalVehicles}</p><p className="text-sm text-gray-500">{activeVehicles} active</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Compliance Issues</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">{complianceIssues}</p><p className="text-sm text-gray-500">Expired or expiring soon</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Compliance Rate</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">{totalVehicles > 0 ? Math.round(((totalVehicles - complianceIssues) / totalVehicles) * 100) : 0}%</p><p className="text-sm text-gray-500">Vehicles in compliance</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Fleet Vehicles</CardTitle><CardDescription>{vehicles.length} vehicles in your fleet</CardDescription></CardHeader>
        <CardContent>
          {loading || tenantLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : vehicles.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No vehicles yet</p>
              <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" />Add Your First Vehicle</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>MOT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => {
                    const status = getStatus(vehicle);
                    const statusColor = status === 'Active' ? 'bg-green-100 text-green-800' : status === 'Warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-bold">{vehicle.registration_number}</TableCell>
                        <TableCell>{vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : '—'}</TableCell>
                        <TableCell className="capitalize">{vehicle.vehicle_type || '—'}</TableCell>
                        <TableCell>{vehicle.insurance_expiry ? (<div className="flex items-center gap-1">{isExpired(vehicle.insurance_expiry) && <AlertTriangle className="h-4 w-4 text-red-600" />}{formatDateOnly(vehicle.insurance_expiry)}</div>) : '—'}</TableCell>
                        <TableCell>{vehicle.mot_expiry ? (<div className="flex items-center gap-1">{isExpired(vehicle.mot_expiry) && <AlertTriangle className="h-4 w-4 text-red-600" />}{formatDateOnly(vehicle.mot_expiry)}</div>) : '—'}</TableCell>
                        <TableCell><Badge className={statusColor}>{status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" aria-label={`Edit ${vehicle.registration_number}`} onClick={() => handleOpenDialog(vehicle)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" aria-label={`Delete ${vehicle.registration_number}`} onClick={() => setDeleteTarget(vehicle)}><Trash className="h-4 w-4 text-red-600" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SafeDialog open={open} onOpenChange={setOpen}>
        <SafeDialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Registration Number *</Label><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="e.g., KCA 123A" required maxLength={20} /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Toyota" /></div><div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Hiace" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Year</Label><Input type="number" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div><div><Label>Capacity</Label><Input type="number" inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="14" /></div></div>
            <div>
              <Label>Vehicle Type *</Label>
              <NativeSelect value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value as VehicleType })} required>
                <option value="psv">PSV (Public)</option>
                <option value="cargo">Cargo</option>
                <option value="pickup">Pickup</option>
                <option value="other">Other</option>
              </NativeSelect>
            </div>
            <div><Label>Insurance Expiry</Label><Input type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} /></div>
            <div><Label>MOT Expiry</Label><Input type="date" value={form.motExpiry} onChange={(e) => setForm({ ...form, motExpiry: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600">{submitting ? 'Saving…' : editing ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete vehicle?"
        description={deleteTarget ? `${deleteTarget.registration_number} will be permanently removed from your fleet. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
