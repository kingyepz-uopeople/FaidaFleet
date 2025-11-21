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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, MoreHorizontal, Trash2, Edit, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Driver = {
  id: string;
  full_name: string;
  phone: string;
  license_number: string | null;
  license_expiry: string | null;
  id_number: string | null;
  is_active: boolean;
  created_at: string;
  tenant_id: string;
  tenants?: { name: string } | null;
};

type Tenant = {
  id: string;
  name: string;
};

export default function AllDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    id_number: '',
    tenant_id: '',
  });
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = drivers.filter((driver) =>
      driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery) ||
      driver.license_number?.includes(searchQuery)
    );
    setFilteredDrivers(filtered);
  }, [searchQuery, drivers]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [driversRes, tenantsRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('*, tenants(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('tenants')
          .select('id, name')
          .eq('is_active', true),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (tenantsRes.error) throw tenantsRes.error;

      setDrivers(driversRes.data || []);
      setTenants(tenantsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (driver?: Driver) => {
    if (driver) {
      setEditingId(driver.id);
      setFormData({
        full_name: driver.full_name,
        phone: driver.phone,
        license_number: driver.license_number || '',
        license_expiry: driver.license_expiry || '',
        id_number: driver.id_number || '',
        tenant_id: driver.tenant_id,
      });
    } else {
      setEditingId(null);
      setFormData({
        full_name: '',
        phone: '',
        license_number: '',
        license_expiry: '',
        id_number: '',
        tenant_id: tenants[0]?.id || '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('drivers')
          .update({
            full_name: formData.full_name,
            phone: formData.phone,
            license_number: formData.license_number || null,
            license_expiry: formData.license_expiry || null,
            id_number: formData.id_number || null,
          } as any)
          .eq('id', editingId);

        if (err) throw err;
        setSuccess('Driver updated successfully');
      } else {
        const { error: err } = await supabase
          .from('drivers')
          .insert([{
            tenant_id: formData.tenant_id,
            full_name: formData.full_name,
            phone: formData.phone,
            license_number: formData.license_number || null,
            license_expiry: formData.license_expiry || null,
            id_number: formData.id_number || null,
            is_active: true,
          }]);

        if (err) throw err;
        setSuccess('Driver created successfully');
      }

      setDialogOpen(false);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save driver');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (driverId: string) => {
    if (!window.confirm('Are you sure you want to delete this driver?')) return;
    
    try {
      const { error: err } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);

      if (err) throw err;
      setSuccess('Driver deleted successfully');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete driver');
    }
  };

  const toggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase
        .from('drivers')
        .update({ is_active: !currentStatus } as any)
        .eq('id', driverId);

      if (err) throw err;
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver');
    }
  };

  const isLicenseExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Drivers</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage drivers across all fleet companies</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Driver' : 'Create Driver'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update driver information' : 'Add a new driver to the system'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div>
                  <Label htmlFor="tenant_id">Fleet Company *</Label>
                  <select
                    id="tenant_id"
                    value={formData.tenant_id}
                    onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                    required
                  >
                    <option value="">Select a fleet company</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+254 700 000000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="LIC123456"
                />
              </div>
              <div>
                <Label htmlFor="license_expiry">License Expiry</Label>
                <Input
                  id="license_expiry"
                  type="date"
                  value={formData.license_expiry}
                  onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="id_number">ID Number</Label>
                <Input
                  id="id_number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  placeholder="12345678"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700">
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Search by name, phone, or license number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Drivers List</CardTitle>
          <CardDescription>Total: {filteredDrivers.length} drivers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Fleet Company</TableHead>
                    <TableHead>License Number</TableHead>
                    <TableHead>License Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDrivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.full_name}</TableCell>
                        <TableCell className="text-sm">{driver.phone}</TableCell>
                        <TableCell className="text-sm">
                          {driver.tenants?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{driver.license_number || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {driver.license_expiry ? (
                            <span className={isLicenseExpired(driver.license_expiry) ? 'text-red-600 font-medium' : ''}>
                              {new Date(driver.license_expiry).toLocaleDateString()}
                              {isLicenseExpired(driver.license_expiry) && ' (Expired)'}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              driver.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'
                            }
                          >
                            {driver.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(driver.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleOpenDialog(driver)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleDriverStatus(driver.id, driver.is_active)}
                                className="cursor-pointer"
                              >
                                {driver.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(driver.id)}
                                className="cursor-pointer text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
