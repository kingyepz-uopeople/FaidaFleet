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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PlusCircle, Loader2, KeyRound } from '@/components/icons';
import { normalizeKenyanPhone, validatePin } from '@/lib/phone';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PinResetDialog } from '@/components/pin-reset-dialog';
import { EmptyState, PageShell, TableScroll } from '@/components/page-shell';

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

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [resetDriver, setResetDriver] = useState<Driver | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    pin: '',
    pin_confirm: '',
    license_number: '',
    license_expiry: '',
    id_number: '',
  });

  const [assignFormData, setAssignFormData] = useState({
    driver_id: '',
    vehicle_id: '',
    start_date: new Date().toISOString().split('T')[0],
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      // Get user's tenant
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) {
        setError('No fleet found. Please complete onboarding.');
        return;
      }

      setTenantId(membership.tenant_id);

      // Fetch drivers
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .eq('tenant_id', membership.tenant_id)
        .order('created_at', { ascending: false });

      if (driversError) throw driversError;
      setDrivers(driversData || []);

      // Fetch vehicles for assignment
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, registration_number')
        .eq('tenant_id', membership.tenant_id)
        .eq('is_active', true)
        .order('registration_number');

      if (vehiclesError) throw vehiclesError;
      setVehicles(vehiclesData || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!tenantId) {
        throw new Error('No tenant found');
      }

      const phone = normalizeKenyanPhone(formData.phone);
      const pinError = validatePin(formData.pin);
      if (!phone) throw new Error('Enter a valid Kenyan phone number');
      if (pinError) throw new Error(pinError);
      if (formData.pin !== formData.pin_confirm) throw new Error('PINs do not match');

      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
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

      // Reset form and close dialog
      setFormData({
        full_name: '',
        phone: '',
        pin: '',
        pin_confirm: '',
        license_number: '',
        license_expiry: '',
        id_number: '',
      });
      setDialogOpen(false);
      
      // Refresh drivers list
      fetchData();
    } catch (err: any) {
      console.error('Error adding driver:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!tenantId) {
        throw new Error('No tenant found');
      }

      // First, set all current assignments for this vehicle to not current
      const { error: updateError } = await supabase
        .from('driver_assignments')
        .update({ is_current: false, end_date: new Date().toISOString().split('T')[0] })
        .eq('vehicle_id', assignFormData.vehicle_id)
        .eq('is_current', true);

      if (updateError) throw updateError;

      // Create new assignment
      const { error: insertError } = await supabase
        .from('driver_assignments')
        .insert({
          tenant_id: tenantId,
          driver_id: assignFormData.driver_id,
          vehicle_id: assignFormData.vehicle_id,
          start_date: assignFormData.start_date,
          is_current: true,
        });

      if (insertError) throw insertError;

      // Reset form and close dialog
      setAssignFormData({
        driver_id: '',
        vehicle_id: '',
        start_date: new Date().toISOString().split('T')[0],
      });
      setAssignDialogOpen(false);
      
      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error('Error assigning driver:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
        Active
      </Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
        Inactive
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell
      title="Drivers"
      description="Add drivers with a phone number and PIN. Reset a forgotten PIN from the driver record."
      actions={
        <div className="flex flex-wrap gap-2">
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={drivers.length === 0 || vehicles.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Assign to Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAssignDriver}>
                <DialogHeader>
                  <DialogTitle>Assign Driver to Vehicle</DialogTitle>
                  <DialogDescription>
                    Assign a driver to a specific vehicle in your fleet.
                  </DialogDescription>
                </DialogHeader>
                
                {error && (
                  <Alert variant="destructive" className="my-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="driver_select">Driver *</Label>
                    <Select
                      value={assignFormData.driver_id}
                      onValueChange={(value) => setAssignFormData({ ...assignFormData, driver_id: value })}
                      required
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.filter(d => d.is_active).map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vehicle_select">Vehicle *</Label>
                    <Select
                      value={assignFormData.vehicle_id}
                      onValueChange={(value) => setAssignFormData({ ...assignFormData, vehicle_id: value })}
                      required
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={assignFormData.start_date}
                      onChange={(e) => setAssignFormData({ ...assignFormData, start_date: e.target.value })}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssignDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      'Assign Driver'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleAddDriver}>
                <DialogHeader>
                  <DialogTitle>Add New Driver</DialogTitle>
                  <DialogDescription>
                    Add a driver and a PIN. They sign in with this phone number and PIN.
                  </DialogDescription>
                </DialogHeader>
                
                {error && (
                  <Alert variant="destructive" className="my-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      placeholder="John Doe"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0712345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="pin">PIN *</Label>
                    <Input
                      id="pin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      placeholder="4 to 6 digits"
                      value={formData.pin}
                      onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="pin_confirm">Confirm PIN *</Label>
                    <Input
                      id="pin_confirm"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Repeat PIN"
                      value={formData.pin_confirm}
                      onChange={(e) => setFormData({ ...formData, pin_confirm: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      required
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="license_number">License Number</Label>
                    <Input
                      id="license_number"
                      placeholder="DL123456"
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="license_expiry">License Expiry</Label>
                    <Input
                      id="license_expiry"
                      type="date"
                      value={formData.license_expiry}
                      onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="id_number">ID Number</Label>
                    <Input
                      id="id_number"
                      placeholder="12345678"
                      value={formData.id_number}
                      onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Driver'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Driver roster</CardTitle>
          <CardDescription>A list of all drivers in your fleet.</CardDescription>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <EmptyState
              title="No drivers yet"
              description="Add a driver with a phone number and PIN so they can sign in."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add your first driver
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {drivers.map((driver) => (
                  <div key={driver.id} className="rounded-2xl border bg-card p-4 shadow-sm">
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
                      {getStatusBadge(driver.is_active)}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      License {driver.license_number || '—'}
                      {driver.license_expiry ? ` · expires ${new Date(driver.license_expiry).toLocaleDateString()}` : ''}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => setResetDriver(driver)}
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset PIN
                    </Button>
                  </div>
                ))}
              </div>
              <TableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>License Number</TableHead>
                      <TableHead>License Expiry</TableHead>
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
                        <TableCell>{driver.license_number || '-'}</TableCell>
                        <TableCell>
                          {driver.license_expiry
                            ? new Date(driver.license_expiry).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.is_active)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setResetDriver(driver)}>
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
      <PinResetDialog
        open={Boolean(resetDriver)}
        onOpenChange={(open) => { if (!open) setResetDriver(null) }}
        title="Reset driver PIN"
        description="Set a new PIN for this driver. The current PIN cannot be viewed. Share the new PIN once."
        name={resetDriver?.full_name}
        submit={async ({ pin, generate }) => {
          if (!resetDriver) return { error: 'No driver selected', pin: undefined, generated: false }
          const response = await fetch(`/api/drivers/${resetDriver.id}/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin, generate }),
          })
          return response.json()
        }}
      />
    </PageShell>
  );
}
