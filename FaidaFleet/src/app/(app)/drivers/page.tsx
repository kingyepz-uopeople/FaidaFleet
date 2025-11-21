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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlusCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
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

      const { error } = await supabase
        .from('drivers')
        .insert({
          tenant_id: tenantId,
          full_name: formData.full_name,
          phone: formData.phone,
          license_number: formData.license_number || null,
          license_expiry: formData.license_expiry || null,
          id_number: formData.id_number || null,
          is_active: true,
        });

      if (error) throw error;

      // Reset form and close dialog
      setFormData({
        full_name: '',
        phone: '',
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Drivers</h1>
        <div className="flex gap-2">
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
                    Add a new driver to your fleet. All fields marked with * are required.
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
                      placeholder="+254712345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver Roster</CardTitle>
          <CardDescription>A list of all drivers in your fleet.</CardDescription>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No drivers yet. Add your first driver to get started!</p>
              <Button onClick={() => setDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Driver
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License Number</TableHead>
                  <TableHead>License Expiry</TableHead>
                  <TableHead>Status</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
