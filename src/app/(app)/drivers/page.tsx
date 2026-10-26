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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PlusCircle, Loader2, KeyRound, Users } from '@/components/icons';
import { normalizeKenyanPhone, validatePin } from '@/lib/phone';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { PinResetDialog } from '@/components/pin-reset-dialog';
import { EmptyState, PageShell, TableScroll } from '@/components/page-shell';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { StatCard } from '@/components/stat-card';

type Driver = {
  id: string;
  full_name: string;
  phone: string;
  license_number: string | null;
  license_expiry: string | null;
  id_number: string | null;
  is_active: boolean;
};

type Vehicle = {
  id: string;
  registration_number: string;
};

const EMPTY_DRIVER = {
  full_name: '',
  phone: '',
  pin: '',
  pin_confirm: '',
  license_number: '',
  license_expiry: '',
  id_number: '',
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [resetDriver, setResetDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState(EMPTY_DRIVER);
  const [assignFormData, setAssignFormData] = useState({
    driver_id: '',
    vehicle_id: '',
    start_date: new Date().toISOString().split('T')[0],
  });
  const supabase = useMemo(() => createClient(), []);

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

      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        setLoadError('No fleet is linked to this account yet. Finish onboarding to add drivers.');
        return;
      }

      setTenantId(membership.tenant_id);

      const [driversRes, vehiclesRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('*')
          .eq('tenant_id', membership.tenant_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', membership.tenant_id)
          .eq('is_active', true)
          .order('registration_number'),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setDrivers((driversRes.data || []) as Driver[]);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load drivers';
      setLoadError(message);
      toastError(message, 'Could not load drivers');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormData(EMPTY_DRIVER);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleAddDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (!tenantId) throw new Error('No fleet found for this account.');

      const phone = normalizeKenyanPhone(formData.phone);
      const pinError = validatePin(formData.pin);
      if (!phone) throw new Error('Enter a valid Kenyan phone number, for example 0712345678');
      if (pinError) throw new Error(pinError);
      if (formData.pin !== formData.pin_confirm) throw new Error('The two PINs do not match');
      if (!formData.full_name.trim()) throw new Error('Driver name is required');

      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          phone,
          pin: formData.pin,
          license_number: formData.license_number || null,
          license_expiry: formData.license_expiry || null,
          id_number: formData.id_number || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Could not add the driver');
      }

      toastSuccess(`${formData.full_name.trim()} can now sign in with their phone and PIN.`, 'Driver added');
      setFormData(EMPTY_DRIVER);
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add the driver';
      setFormError(message);
      toastError(message, 'Could not add the driver');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssign = () => {
    setAssignFormData({
      driver_id: '',
      vehicle_id: '',
      start_date: new Date().toISOString().split('T')[0],
    });
    setAssignError(null);
    setAssignDialogOpen(true);
  };

  const handleAssignDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAssignError(null);

    try {
      if (!tenantId) throw new Error('No fleet found for this account.');

      // Validate ids before touching the database — a stray empty string
      // produces a Postgres "invalid input syntax for type uuid" error.
      const driverId = requireUuid(assignFormData.driver_id, 'driver');
      const vehicleId = requireUuid(assignFormData.vehicle_id, 'vehicle');
      if (!assignFormData.start_date) throw new Error('Choose a start date');

      const previous = await supabase
        .from('driver_assignments')
        .update({ is_current: false, end_date: assignFormData.start_date })
        .eq('vehicle_id', vehicleId)
        .eq('is_current', true)
        .select('id');

      assertMutation(previous, 'Could not end the previous assignment', { expectsRows: 0 });

      const inserted = await supabase
        .from('driver_assignments')
        .insert({
          tenant_id: tenantId,
          driver_id: driverId,
          vehicle_id: vehicleId,
          start_date: assignFormData.start_date,
          is_current: true,
        })
        .select('id');

      assertMutationRow(inserted, 'Could not create the assignment');
      toastSuccess('Driver assigned to the vehicle.', 'Assignment saved');
      setAssignDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not assign the driver';
      setAssignError(message);
      toastError(message, 'Could not assign the driver');
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const activeDrivers = drivers.filter((driver) => driver.is_active).length;
  const withPinIssues = drivers.filter((driver) => !driver.license_number).length;

  return (
    <PageShell
      title="Drivers"
      description="Add drivers with a phone number and PIN. Reset a forgotten PIN from the driver record."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={openAssign}
            disabled={drivers.length === 0 || vehicles.length === 0}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Assign to vehicle
          </Button>
          <Button type="button" className="min-h-11" onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add driver
          </Button>
        </div>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="Drivers" value={String(drivers.length)} description={`${activeDrivers} active`} Icon={Users} />
        <StatCard title="Vehicles ready" value={String(vehicles.length)} description="Available to assign" Icon={PlusCircle} />
        <StatCard
          title="Missing licence"
          value={String(withPinIssues)}
          description="Add licence details for compliance"
          Icon={KeyRound}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver roster</CardTitle>
          <CardDescription>A list of all drivers in your fleet.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : drivers.length === 0 ? (
            <EmptyState
              title="No drivers yet"
              description="Add a driver with a phone number and PIN so they can sign in."
              action={
                <Button type="button" onClick={openCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add your first driver
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {drivers.map((driver) => (
                  <article key={driver.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{getInitials(driver.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{driver.full_name}</p>
                          <p className="text-sm text-muted-foreground">{driver.phone}</p>
                        </div>
                      </div>
                      <Badge className={driver.is_active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                        {driver.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Licence {driver.license_number || '—'}
                      {driver.license_expiry
                        ? ` · expires ${new Date(driver.license_expiry).toLocaleDateString('en-KE')}`
                        : ''}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 min-h-11 w-full"
                      onClick={() => setResetDriver(driver)}
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset PIN
                    </Button>
                  </article>
                ))}
              </div>

              <TableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Licence number</TableHead>
                      <TableHead>Licence expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">PIN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>{getInitials(driver.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{driver.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{driver.phone}</TableCell>
                        <TableCell>{driver.license_number || '—'}</TableCell>
                        <TableCell>
                          {driver.license_expiry
                            ? new Date(driver.license_expiry).toLocaleDateString('en-KE')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={driver.is_active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-muted text-muted-foreground hover:bg-muted'}>
                            {driver.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setResetDriver(driver)}>
                            <KeyRound className="h-4 w-4" />
                            Reset PIN
                          </Button>
                        </TableCell>
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
        title="Add driver"
        description="The driver signs in with this phone number and PIN. The PIN is stored as a hash, never in plain text."
      >
        <form onSubmit={handleAddDriver} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input
              id="full_name"
              placeholder="John Doe"
              autoComplete="name"
              value={formData.full_name}
              onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number *</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712345678"
              value={formData.phone}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN *</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="4 to 6 digits"
                value={formData.pin}
                onChange={(event) => setFormData({ ...formData, pin: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin_confirm">Confirm PIN *</Label>
              <Input
                id="pin_confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="Repeat PIN"
                value={formData.pin_confirm}
                onChange={(event) => setFormData({ ...formData, pin_confirm: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_number">Licence number</Label>
            <Input
              id="license_number"
              placeholder="DL123456"
              value={formData.license_number}
              onChange={(event) => setFormData({ ...formData, license_number: event.target.value })}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="license_expiry">Licence expiry</Label>
              <Input
                id="license_expiry"
                type="date"
                value={formData.license_expiry}
                onChange={(event) => setFormData({ ...formData, license_expiry: event.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id_number">ID number</Label>
              <Input
                id="id_number"
                inputMode="numeric"
                placeholder="12345678"
                value={formData.id_number}
                onChange={(event) => setFormData({ ...formData, id_number: event.target.value })}
                disabled={submitting}
              />
            </div>
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
                  Adding…
                </>
              ) : (
                'Add driver'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        title="Assign driver to vehicle"
        description="The previous driver of this vehicle is marked as ended on the start date."
      >
        <form onSubmit={handleAssignDriver} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver_select">Driver *</Label>
            <NativeSelect
              id="driver_select"
              value={assignFormData.driver_id}
              onChange={(event) => setAssignFormData({ ...assignFormData, driver_id: event.target.value })}
              required
              disabled={submitting}
            >
              <option value="">Select driver</option>
              {drivers.filter((driver) => driver.is_active).map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle_select">Vehicle *</Label>
            <NativeSelect
              id="vehicle_select"
              value={assignFormData.vehicle_id}
              onChange={(event) => setAssignFormData({ ...assignFormData, vehicle_id: event.target.value })}
              required
              disabled={submitting}
            >
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration_number}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Start date *</Label>
            <Input
              id="start_date"
              type="date"
              value={assignFormData.start_date}
              onChange={(event) => setAssignFormData({ ...assignFormData, start_date: event.target.value })}
              required
              disabled={submitting}
            />
          </div>

          {assignError && (
            <Alert variant="destructive">
              <AlertDescription>{assignError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setAssignDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                'Assign driver'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>

      <PinResetDialog
        open={Boolean(resetDriver)}
        onOpenChange={(open) => {
          if (!open) setResetDriver(null);
        }}
        title="Reset driver PIN"
        description="Set a new PIN for this driver. The current PIN cannot be viewed. Share the new PIN once."
        name={resetDriver?.full_name}
        submit={async ({ pin, generate }) => {
          if (!resetDriver) return { error: 'No driver selected', generated: false };
          const response = await fetch(`/api/drivers/${resetDriver.id}/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin, generate }),
          });
          return response.json();
        }}
      />
    </PageShell>
  );
}
