'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, Loader2, Trash2, Edit, Wrench, Receipt, Clock } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { EmptyState, PageShell, TableScroll } from '@/components/page-shell';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { StatCard } from '@/components/stat-card';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { DriverScopeNotice, LockedValue } from '@/components/driver-scope';

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';

type MaintenanceType = 'service' | 'repair' | 'inspection' | 'other';

type Maintenance = {
  id: string;
  vehicle_id: string;
  date: string;
  type: MaintenanceType;
  description: string;
  cost: number | null;
  next_service_date: string | null;
  vehicles: { registration_number: string } | null;
};

type Option = { id: string; label: string };

const TYPE_LABELS: Record<MaintenanceType, string> = {
  service: 'Service',
  repair: 'Repair',
  inspection: 'Inspection',
  other: 'Other',
};

const EMPTY_FORM = {
  vehicleId: '',
  type: 'service' as MaintenanceType,
  description: '',
  cost: '',
  date: new Date().toISOString().split('T')[0],
  nextServiceDate: '',
};

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    tenantId,
    isDriver,
    vehicleId,
    vehicleLabel,
    loadError: accessError,
  } = useFleetAccess();
  const canRecord = !isDriver || Boolean(vehicleId);

  useEffect(() => {
    if (!accessLoading) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, tenantId, isDriver, vehicleId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      if (!tenantId) {
        setLoadError(accessError || 'No fleet is linked to this account yet. Finish onboarding to schedule maintenance.');
        return;
      }

      const [maintenanceRes, vehiclesRes] = await Promise.all([
        (isDriver
          ? supabase
              .from('maintenance_logs')
              .select('*, vehicles(registration_number)')
              .eq('tenant_id', tenantId)
              .eq('vehicle_id', vehicleId || NO_MATCH_UUID)
          : supabase
              .from('maintenance_logs')
              .select('*, vehicles(registration_number)')
              .eq('tenant_id', tenantId)
        ).order('date', { ascending: false }),
        isDriver
          ? supabase.from('vehicles').select('id, registration_number').eq('id', vehicleId || NO_MATCH_UUID).limit(1)
          : supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tenantId).eq('is_active', true).order('registration_number'),
      ]);

      if (maintenanceRes.error) throw maintenanceRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setMaintenance((maintenanceRes.data || []) as Maintenance[]);
      setVehicles((vehiclesRes.data || []).map((row) => ({ id: row.id, label: row.registration_number })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load maintenance records';
      setLoadError(message);
      toastError(message, 'Could not load maintenance records');
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
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (record: Maintenance) => {
    if (isDriver) return;
    setEditing(record);
    setForm({
      vehicleId: record.vehicle_id,
      type: record.type,
      description: record.description || '',
      cost: record.cost?.toString() || '',
      date: record.date,
      nextServiceDate: record.next_service_date || '',
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
      if (isDriver && editing) throw new Error('Drivers cannot edit maintenance records.');
      if (!canRecord) throw new Error('Ask your fleet owner to assign you a current vehicle first.');
      const selectedVehicleId = requireUuid(isDriver ? vehicleId : form.vehicleId, 'vehicle');
      if (!form.description.trim()) throw new Error('Describe the work that was done');
      if (!form.date) throw new Error('Choose the maintenance date');

      const payload = {
        tenant_id: tenantId,
        vehicle_id: selectedVehicleId,
        type: form.type,
        description: form.description.trim(),
        cost: form.cost ? Number.parseFloat(form.cost) : null,
        date: form.date,
        next_service_date: form.nextServiceDate || null,
      };

      const result = editing
        ? await supabase.from('maintenance_logs').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('maintenance_logs').insert([payload]).select('id');

      assertMutationRow(result, editing ? 'Could not update the record' : 'Could not record the maintenance');
      toastSuccess(editing ? 'Maintenance record updated.' : 'Maintenance recorded.', 'Saved');
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the maintenance record';
      setFormError(message);
      toastError(message, 'Could not save the maintenance record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: Maintenance) => {
    if (isDriver) return;
    if (!window.confirm('Delete this maintenance record? This cannot be undone.')) return;
    try {
      const result = await supabase.from('maintenance_logs').delete().eq('id', record.id).select('id');
      assertMutation(result, 'Could not delete the record');
      toastSuccess('Maintenance record deleted.', 'Deleted');
      await fetchData();
    } catch (err) {
      toastError(err, 'Could not delete the maintenance record');
    }
  };

  const totalCost = maintenance.reduce((sum, record) => sum + (record.cost || 0), 0);
  const upcomingServices = maintenance.filter(
    (record) => record.next_service_date && new Date(record.next_service_date) > new Date(),
  ).length;

  return (
    <PageShell
      title={isDriver ? 'My maintenance' : 'Maintenance'}
      description={isDriver ? 'Log work on your assigned vehicle.' : 'Track services, repairs, and upcoming service dates.'}
      actions={
        <Button type="button" className="min-h-11" onClick={openCreate} disabled={!canRecord}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Record maintenance
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
        <StatCard title="Total maintenance cost" value={`KES ${totalCost.toLocaleString()}`} description="All time" Icon={Wrench} />
        <StatCard title="Records" value={String(maintenance.length)} description="Services and repairs" Icon={Receipt} />
        <StatCard title="Upcoming services" value={String(upcomingServices)} description="Scheduled ahead" Icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance records</CardTitle>
          <CardDescription>{maintenance.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || accessLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : maintenance.length === 0 ? (
            <EmptyState
              title="No maintenance records yet"
              description="Log a service or repair to keep vehicle history and costs up to date."
              action={canRecord ? (
                <Button type="button" onClick={openCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Record maintenance
                </Button>
              ) : undefined}
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {maintenance.map((record) => (
                  <article key={record.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{record.vehicles?.registration_number || 'Vehicle removed'}</p>
                        <p className="text-sm text-muted-foreground">{formatDateOnly(record.date)}</p>
                      </div>
                      <Badge variant="secondary">{TYPE_LABELS[record.type]}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{record.description}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-semibold">KES {(record.cost || 0).toLocaleString()}</span>
                      <span className="text-muted-foreground">
                        Next: {record.next_service_date ? formatDateOnly(record.next_service_date) : '—'}
                      </span>
                    </div>
                    {!isDriver && (
                      <div className="mt-3 flex gap-2">
                        <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => openEdit(record)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 text-destructive"
                          onClick={() => handleDelete(record)}
                          aria-label="Delete maintenance record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <TableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Next service</TableHead>
                      {!isDriver && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDateOnly(record.date)}</TableCell>
                        <TableCell className="font-medium">{record.vehicles?.registration_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{TYPE_LABELS[record.type]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{record.description}</TableCell>
                        <TableCell className="font-semibold">KES {(record.cost || 0).toLocaleString()}</TableCell>
                        <TableCell>{record.next_service_date ? formatDateOnly(record.next_service_date) : '—'}</TableCell>
                        {!isDriver && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => openEdit(record)}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit maintenance record</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11 text-destructive"
                                onClick={() => handleDelete(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete maintenance record</span>
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
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
        title={editing ? 'Edit maintenance' : 'Record maintenance'}
        description={isDriver ? 'Your current vehicle is filled in for you.' : 'Maintenance costs are included in your fleet profit calculations.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDriver ? (
            <LockedValue id="maintenance_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Set by your fleet owner." />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="maintenance_vehicle">Vehicle *</Label>
              <NativeSelect
                id="maintenance_vehicle"
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
          )}

          <div className="space-y-2">
            <Label htmlFor="maintenance_type">Type *</Label>
            <NativeSelect
              id="maintenance_type"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as MaintenanceType })}
              required
              disabled={submitting}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance_description">Description *</Label>
            <textarea
              id="maintenance_description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="What was done?"
              rows={3}
              required
              disabled={submitting}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maintenance_cost">Cost (KES)</Label>
              <Input
                id="maintenance_cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(event) => setForm({ ...form, cost: event.target.value })}
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance_date">Date *</Label>
              <Input
                id="maintenance_date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_service">Next service date</Label>
            <Input
              id="next_service"
              type="date"
              value={form.nextServiceDate}
              onChange={(event) => setForm({ ...form, nextServiceDate: event.target.value })}
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
                'Update record'
              ) : (
                'Record maintenance'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>
    </PageShell>
  );
}
