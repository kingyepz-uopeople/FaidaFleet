'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Loader2, Trash2, Edit, Zap, Wallet, TrendingUp } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { optionalNotes, withRecordedBy } from '@/lib/record-payload';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { EmptyState, LoadFailure, PageShell, TableScroll } from '@/components/page-shell';
import { StatCard } from '@/components/stat-card';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { DriverScopeNotice } from '@/components/driver-scope';
import { RecordOriginBadge } from '@/components/record-origin-badge';
import { EMPTY_FORM, type Trip, type Option } from './trip-types';

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
const TRIP_FIELDS = 'id, vehicle_id, driver_id, trip_date, distance_km, earnings, expenses, start_location, end_location, notes, recorded_by, vehicles(registration_number), drivers(full_name, user_id)';
const TripFormDialog = dynamic(() => import('./trip-form-dialog'), {
  ssr: false,
  loading: () => <span role="status" className="sr-only">Opening trip form…</span>,
});


export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [drivers, setDrivers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
        setLoadError(accessError || 'No fleet is linked to this account yet. Finish onboarding to record trips.');
        return;
      }

      const [tripsRes, vehiclesRes, driversRes] = await Promise.all([
        (isDriver
          ? supabase
              .from('trips')
              .select(TRIP_FIELDS)
              .eq('tenant_id', tenantId)
              .eq('driver_id', driverId || NO_MATCH_UUID)
          : supabase
              .from('trips')
              .select(TRIP_FIELDS)
              .eq('tenant_id', tenantId)
        ).order('created_at', { ascending: false }).order('trip_date', { ascending: false }),
        isDriver
          ? supabase.from('vehicles').select('id, registration_number').eq('id', vehicleId || NO_MATCH_UUID).limit(1)
          : supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tenantId).eq('is_active', true).order('registration_number'),
        isDriver
          ? supabase.from('drivers').select('id, full_name').eq('id', driverId || NO_MATCH_UUID).limit(1)
          : supabase.from('drivers').select('id, full_name').eq('tenant_id', tenantId).eq('is_active', true).order('full_name'),
      ]);

      if (tripsRes.error) throw tripsRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (driversRes.error) throw driversRes.error;

      setTrips((tripsRes.data || []) as Trip[]);
      setVehicles((vehiclesRes.data || []).map((row) => ({ id: row.id, label: row.registration_number })));
      setDrivers((driversRes.data || []).map((row) => ({ id: row.id, label: row.full_name })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load trips';
      setLoadError(message);
      toastError(message, 'Could not load trips');
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

  const openEdit = (trip: Trip) => {
    if (isDriver) return;
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
      notes: trip.notes || '',
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
      if (isDriver && editing) throw new Error('Drivers cannot edit recorded trips.');
      if (!canRecord) throw new Error('Ask your fleet owner to link your driver record and current vehicle first.');
      const selectedVehicleId = requireUuid(isDriver ? vehicleId : form.vehicleId, 'vehicle');
      const selectedDriverId = requireUuid(isDriver ? driverId : form.driverId, 'driver');
      if (!form.tripDate) throw new Error('Choose the trip date');

      const payload = {
        tenant_id: tenantId,
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        trip_date: form.tripDate,
        distance_km: form.distanceKm ? Number.parseFloat(form.distanceKm) : null,
        earnings: form.earnings ? Number.parseFloat(form.earnings) : 0,
        expenses: form.expenses ? Number.parseFloat(form.expenses) : 0,
        start_location: form.startLocation.trim() || null,
        end_location: form.endLocation.trim() || null,
        notes: optionalNotes(form.notes),
      };

      const result = editing
        ? await supabase.from('trips').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('trips').insert([withRecordedBy(payload, userId)]).select('id');

      assertMutationRow(result, editing ? 'Could not update the trip' : 'Could not record the trip');
      toastSuccess(editing ? 'Trip updated.' : 'Trip recorded.', 'Saved');
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the trip';
      setFormError(message);
      toastError(message, 'Could not save the trip');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (trip: Trip) => {
    if (isDriver) return;
    if (!window.confirm('Delete this trip? This cannot be undone.')) return;
    try {
      const result = await supabase.from('trips').delete().eq('id', trip.id).select('id');
      assertMutation(result, 'Could not delete the trip');
      toastSuccess('Trip deleted.', 'Deleted');
      await fetchData();
    } catch (err) {
      toastError(err, 'Could not delete the trip');
    }
  };

  const totalEarnings = trips.reduce((sum, trip) => sum + (trip.earnings || 0), 0);
  const totalExpenses = trips.reduce((sum, trip) => sum + (trip.expenses || 0), 0);
  const totalProfit = totalEarnings - totalExpenses;
  const isLoading = loading || accessLoading;

  return (
    <PageShell
      loading={isLoading}
      title={isDriver ? 'My trips' : 'Trips & routes'}
      description={isDriver ? 'Record your trips for your assigned vehicle.' : 'Track individual trips, distance, and earnings.'}
      actions={
        <Button type="button" className="min-h-11" onClick={openCreate} disabled={!canRecord}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Record trip
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
        <StatCard loading={isLoading} title="Total earnings" value={`KES ${totalEarnings.toLocaleString()}`} description={`${trips.length} trips`} Icon={Wallet} />
        <StatCard loading={isLoading} title="Total expenses" value={`KES ${totalExpenses.toLocaleString()}`} description="Fuel and running costs" Icon={Zap} />
        <StatCard loading={isLoading} title="Net profit" value={`KES ${totalProfit.toLocaleString()}`} description="Earnings minus expenses" Icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trip records</CardTitle>
          <CardDescription>
            {isLoading ? <Skeleton className="h-4 w-28" /> : `${trips.length} trips recorded`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8" role="status" aria-label="Loading trips">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="sr-only">Loading trips…</span>
            </div>
          ) : loadError ? (
            <LoadFailure label="trips" message={loadError} onRetry={fetchData} />
          ) : trips.length === 0 ? (
            <EmptyState
              title="No trips recorded yet"
              description="Record a trip to track distance, earnings, and running costs per vehicle."
              action={canRecord ? (
                <Button type="button" onClick={openCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Record your first trip
                </Button>
              ) : undefined}
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {trips.map((trip) => (
                  <article key={trip.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {trip.vehicles?.registration_number || 'Vehicle removed'}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {trip.drivers?.full_name || 'Driver removed'}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground">{formatDateOnly(trip.trip_date)}</span>
                    </div>
                    <div className="mt-2">
                      <RecordOriginBadge recordedBy={trip.recorded_by} driverUserId={trip.drivers?.user_id} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Distance</dt>
                        <dd>{trip.distance_km != null ? `${trip.distance_km} km` : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Earnings</dt>
                        <dd className="text-emerald-700">KES {(trip.earnings || 0).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Expenses</dt>
                        <dd className="text-rose-700">KES {(trip.expenses || 0).toLocaleString()}</dd>
                      </div>
                    </dl>
                    {!isDriver && (
                      <div className="mt-3 flex gap-2">
                        <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => openEdit(trip)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 text-destructive"
                          onClick={() => handleDelete(trip)}
                          aria-label="Delete trip"
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
                      <TableHead>Driver</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Expenses</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Entry</TableHead>
                      {!isDriver && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map((trip) => (
                      <TableRow key={trip.id}>
                        <TableCell>{formatDateOnly(trip.trip_date)}</TableCell>
                        <TableCell className="font-medium">{trip.vehicles?.registration_number || '—'}</TableCell>
                        <TableCell>{trip.drivers?.full_name || '—'}</TableCell>
                        <TableCell>{trip.distance_km != null ? `${trip.distance_km} km` : '—'}</TableCell>
                        <TableCell className="font-medium text-emerald-700">KES {(trip.earnings || 0).toLocaleString()}</TableCell>
                        <TableCell className="font-medium text-rose-700">KES {(trip.expenses || 0).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">KES {((trip.earnings || 0) - (trip.expenses || 0)).toLocaleString()}</TableCell>
                        <TableCell><RecordOriginBadge recordedBy={trip.recorded_by} driverUserId={trip.drivers?.user_id} /></TableCell>
                        {!isDriver && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => openEdit(trip)}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit trip</span>
                              </Button>
                              <Button type="button" variant="ghost" size="sm" className="min-h-11 text-destructive" onClick={() => handleDelete(trip)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete trip</span>
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

      {dialogOpen && (
        <TripFormDialog
          editing={editing} form={form} setForm={setForm} setDialogOpen={setDialogOpen}
          isDriver={isDriver} vehicleLabel={vehicleLabel} driverName={driverName}
          vehicles={vehicles} drivers={drivers} submitting={submitting} formError={formError}
          handleSubmit={handleSubmit}
        />
      )}
    </PageShell>
  );
}
