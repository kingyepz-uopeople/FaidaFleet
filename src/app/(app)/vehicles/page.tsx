'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, PageShell, TableScroll } from '@/components/page-shell';
import { StatCard } from '@/components/stat-card';
import { PlusCircle, Loader2, Trash2, Edit, AlertTriangle, Truck, BadgeCheck } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { primaryMembership } from '@/lib/fleet-access';
import { assertMutationRow, assertMutation } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly, isDateBeforeToday } from '@/lib/dates';
import { vehicleComplianceStatus } from '@/lib/fleet-metrics';

import { EMPTY_FORM, type Vehicle } from './vehicle-types';

const VehicleFormDialog = dynamic(() => import('./vehicle-form-dialog'), {
  ssr: false,
  loading: () => <span role="status" className="sr-only">Opening vehicle form…</span>,
});

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = React.useMemo(() => createClient(), []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to sign in again.');

      const { data: membershipRows, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (membershipError) throw membershipError;
      const membership = primaryMembership(membershipRows || []);
      if (!membership) {
        setLoadError('No fleet is linked to this account yet. Finish onboarding to add vehicles.');
        return;
      }

      setTenantId(membership.tenant_id);
      const { data, error: err } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', membership.tenant_id)
        .order('registration_number');

      if (err) throw err;
      setVehicles((data || []) as Vehicle[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load vehicles';
      setLoadError(message);
      toastError(message, 'Could not load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    setForm({
      registration: vehicle.registration_number,
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year?.toString() || '',
      capacity: vehicle.capacity?.toString() || '',
      vehicleType: vehicle.vehicle_type || 'psv',
      insuranceExpiry: vehicle.insurance_expiry || '',
      motExpiry: vehicle.mot_expiry || '',
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
      if (!form.registration.trim()) throw new Error('Registration number is required.');

      const payload = {
        tenant_id: tenantId,
        registration_number: form.registration.trim().toUpperCase(),
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number.parseInt(form.year, 10) : null,
        capacity: form.capacity ? Number.parseInt(form.capacity, 10) : null,
        vehicle_type: form.vehicleType,
        insurance_expiry: form.insuranceExpiry || null,
        mot_expiry: form.motExpiry || null,
      };

      const result = editing
        ? await supabase.from('vehicles').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('vehicles').insert([{ ...payload, is_active: true }]).select('id');

      assertMutationRow(result, editing ? 'Could not update the vehicle' : 'Could not add the vehicle');
      toastSuccess(editing ? 'Vehicle updated.' : 'Vehicle added.', 'Saved');
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the vehicle';
      setFormError(message);
      toastError(message, 'Could not save the vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!window.confirm(`Delete ${vehicle.registration_number}? This cannot be undone.`)) return;
    try {
      const result = await supabase.from('vehicles').delete().eq('id', vehicle.id).select('id');
      assertMutation(result, 'Could not delete the vehicle');
      toastSuccess(`${vehicle.registration_number} deleted.`, 'Deleted');
      await fetchData();
    } catch (err) {
      toastError(err, 'Could not delete the vehicle');
    }
  };

  const statusOf = (vehicle: Vehicle) => vehicleComplianceStatus(vehicle);
  const statusClass = (status: string) =>
    status === 'Active'
      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
      : status === 'Warning'
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
        : 'bg-rose-100 text-rose-800 hover:bg-rose-100';

  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((vehicle) => vehicle.is_active).length;
  const complianceIssuesCount = vehicles.filter((vehicle) => statusOf(vehicle) !== 'Active').length;

  return (
    <PageShell
      title="Vehicles"
      description="Manage fleet vehicles and compliance dates."
      actions={
        <Button type="button" onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add vehicle
        </Button>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="Total vehicles" value={String(totalVehicles)} description={`${activeVehicles} active`} Icon={Truck} />
        <StatCard
          title="Compliance issues"
          value={String(complianceIssuesCount)}
          description="Expired or expiring soon"
          Icon={AlertTriangle}
        />
        <StatCard
          title="Compliance rate"
          value={`${totalVehicles > 0 ? Math.round(((totalVehicles - complianceIssuesCount) / totalVehicles) * 100) : 0}%`}
          description="Vehicles in compliance"
          Icon={BadgeCheck}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fleet vehicles</CardTitle>
          <CardDescription>{vehicles.length} vehicles in your fleet</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : vehicles.length === 0 ? (
            <EmptyState
              title="No vehicles yet"
              description="Add a vehicle to start recording collections, trips, and maintenance."
              action={
                <Button type="button" onClick={openCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add your first vehicle
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {vehicles.map((vehicle) => {
                  const status = statusOf(vehicle);
                  return (
                    <article key={vehicle.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{vehicle.registration_number}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : 'Make and model not set'}
                          </p>
                        </div>
                        <Badge className={statusClass(status)}>{status}</Badge>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Insurance</dt>
                          <dd>{vehicle.insurance_expiry ? formatDateOnly(vehicle.insurance_expiry) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">MOT</dt>
                          <dd>{vehicle.mot_expiry ? formatDateOnly(vehicle.mot_expiry) : '—'}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => openEdit(vehicle)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 text-destructive"
                          onClick={() => handleDelete(vehicle)}
                          aria-label={`Delete ${vehicle.registration_number}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <TableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registration</TableHead>
                      <TableHead>Make/Model</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>MOT</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => {
                      const status = statusOf(vehicle);
                      return (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-semibold">{vehicle.registration_number}</TableCell>
                          <TableCell>
                            {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : '—'}
                          </TableCell>
                          <TableCell className="capitalize">{vehicle.vehicle_type || '—'}</TableCell>
                          <TableCell>
                            {vehicle.insurance_expiry ? (
                              <span className="flex items-center gap-1">
                                {isDateBeforeToday(vehicle.insurance_expiry) && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                                {formatDateOnly(vehicle.insurance_expiry)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {vehicle.mot_expiry ? (
                              <span className="flex items-center gap-1">
                                {isDateBeforeToday(vehicle.mot_expiry) && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                                {formatDateOnly(vehicle.mot_expiry)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusClass(status)}>{status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => openEdit(vehicle)}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit {vehicle.registration_number}</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11 text-destructive"
                                onClick={() => handleDelete(vehicle)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete {vehicle.registration_number}</span>
                              </Button>
                            </div>
                          </TableCell>
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

      {dialogOpen && (
        <VehicleFormDialog
          editing={editing} form={form} setForm={setForm} setDialogOpen={setDialogOpen}
          submitting={submitting} formError={formError} handleSubmit={handleSubmit}
        />
      )}
    </PageShell>
  );
}
