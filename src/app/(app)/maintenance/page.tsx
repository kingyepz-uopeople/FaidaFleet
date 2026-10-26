'use client';
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

type MaintenanceRow = Database['public']['Tables']['maintenance_logs']['Row'] & {
  vehicles: { registration_number: string } | null;
};

type VehicleOption = { id: string; registration_number: string };

type MaintenanceType = NonNullable<Database['public']['Tables']['maintenance_logs']['Insert']['type']>;

const MAINTENANCE_TYPES: ReadonlyArray<{ value: MaintenanceType; label: string }> = [
  { value: 'service', label: 'Service' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

type MaintenanceForm = {
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  cost: string;
  date: string;
  nextServiceDate: string;
};

const EMPTY_FORM: MaintenanceForm = {
  vehicleId: '',
  type: 'service',
  description: '',
  cost: '',
  date: new Date().toISOString().split('T')[0],
  nextServiceDate: '',
};

export default function MaintenancePage() {
  const { tenantId, userId, loading: tenantLoading, error: tenantError } = useActiveTenant();
  const [maintenance, setMaintenance] = useState<MaintenanceRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRow | null>(null);
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

      const [maintenanceRes, vehiclesRes] = await Promise.all([
        supabase
          .from('maintenance_logs')
          .select('*, vehicles(registration_number)')
          .eq('tenant_id', tId)
          .order('date', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', tId)
          .eq('is_active', true),
      ]);

      if (maintenanceRes.error) throw maintenanceRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setMaintenance((maintenanceRes.data as unknown as MaintenanceRow[]) || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load maintenance records.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (m?: MaintenanceRow) => {
    if (m) {
      setEditing(m);
      setForm({
        vehicleId: m.vehicle_id,
        type: m.type,
        description: m.description || '',
        cost: m.cost?.toString() || '',
        date: m.date,
        nextServiceDate: m.next_service_date || '',
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
      toast({ title: 'No active fleet', description: tenantError || 'Set up your fleet before recording maintenance.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      assertUuid(form.vehicleId, 'Vehicle');
      const payload = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId,
        type: form.type,
        description: form.description.trim(),
        cost: form.cost ? parseFloat(form.cost) : null,
        date: form.date,
        next_service_date: form.nextServiceDate || null,
      };
      if (editing) {
        assertUuid(editing.id, 'Maintenance record');
        await requireRows(
          supabase.from('maintenance_logs').update(payload).eq('id', editing.id).select('id'),
          'maintenance record',
          'update',
        );
        toast({ title: 'Maintenance updated', description: 'The record was saved.' });
      } else {
        await requireRows(
          supabase
            .from('maintenance_logs')
            .insert([{ ...payload, recorded_by: userId }])
            .select('id'),
          'maintenance record',
          'create',
        );
        toast({ title: 'Maintenance recorded', description: 'The new record is in your scheduler.' });
      }
      setOpen(false);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: editing ? 'Could not update maintenance' : 'Could not record maintenance',
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
      assertUuid(deleteTarget.id, 'Maintenance record');
      await requireRows(
        supabase.from('maintenance_logs').delete().eq('id', deleteTarget.id).select('id'),
        'maintenance record',
        'delete',
      );
      toast({ title: 'Maintenance record deleted', description: 'The record was removed.' });
      setDeleteTarget(null);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: 'Could not delete maintenance record',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalCost = maintenance.reduce((sum, m) => sum + Number(m.cost || 0), 0);
  const upcomingServices = maintenance.filter(
    (m) => m.next_service_date && new Date(m.next_service_date) > new Date(),
  ).length;
  const pageBlocked = !tenantLoading && !tenantId;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Scheduler</h1>
          <p className="text-gray-600 dark:text-gray-400">Track vehicle maintenance and repairs</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="mr-2 h-4 w-4" />Record Maintenance
        </Button>
      </div>

      {(loadError || tenantError) && (
        <Alert variant="destructive">
          <AlertDescription>{loadError || tenantError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-lg">Total Maintenance Cost</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalCost.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Records</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-purple-600">{maintenance.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Upcoming Services</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-orange-600">{upcomingServices}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Maintenance Records</CardTitle><CardDescription>{maintenance.length} records found</CardDescription></CardHeader>
        <CardContent>
          {loading || tenantLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : maintenance.length === 0 ? (
            <div className="py-8 text-center text-gray-500"><p>No maintenance records yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Next Service</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenance.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{format(new Date(m.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-bold">{m.vehicles?.registration_number || '—'}</TableCell>
                      <TableCell><Badge className="capitalize">{m.type}</Badge></TableCell>
                      <TableCell>{m.description}</TableCell>
                      <TableCell className="font-bold">KES {Number(m.cost || 0).toLocaleString()}</TableCell>
                      <TableCell>{m.next_service_date ? format(new Date(m.next_service_date), 'MMM dd, yyyy') : '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" aria-label="Edit maintenance record" onClick={() => handleOpenDialog(m)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" aria-label="Delete maintenance record" onClick={() => setDeleteTarget(m)}><Trash className="h-4 w-4 text-red-600" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Maintenance' : 'Record Maintenance'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Vehicle *</Label>
              <NativeSelect value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
                <option value="" disabled>Select vehicle</option>
                {vehicles.map((v) => (<option key={v.id} value={v.id}>{v.registration_number}</option>))}
              </NativeSelect>
            </div>
            <div>
              <Label>Type *</Label>
              <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MaintenanceType })}>
                {MAINTENANCE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </NativeSelect>
            </div>
            <div>
              <Label>Description *</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was done?"
                rows={3}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              />
            </div>
            <div><Label>Cost (KES)</Label><Input type="number" step="0.01" min="0" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" /></div>
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div><Label>Next Service Date</Label><Input type="date" value={form.nextServiceDate} onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} /></div>
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
        title="Delete maintenance record?"
        description="This maintenance record will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
