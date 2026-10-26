'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { MoreHorizontal, Trash2, Edit, Plus, KeyRound } from '@/components/icons';
import { PinResetDialog } from '@/components/pin-reset-dialog';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AdminFeedback,
  AdminPageHeader,
  AdminRecordList,
  AdminSearch,
  RowActionsTrigger,
  StatusBadge,
  adminSelectClass,
  formatDate,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewDrivers, previewTenants } from '@/lib/admin-preview';

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
  const preview = isAdminUiPreview();
  const [drivers, setDrivers] = useState<Driver[]>(preview ? previewDrivers : []);
  const [tenants, setTenants] = useState<Tenant[]>(preview ? previewTenants.map((t) => ({ id: t.id, name: t.name })) : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetDriver, setResetDriver] = useState<Driver | null>(null);
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

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setDrivers(previewDrivers);
        setTenants(previewTenants.map((t) => ({ id: t.id, name: t.name })));
        return;
      }
      const [driversRes, tenantsRes] = await Promise.all([
        supabase.from('drivers').select('*, tenants(name)').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name').eq('is_active', true),
      ]);
      if (driversRes.error) throw driversRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      setDrivers((driversRes.data || []) as Driver[]);
      setTenants(tenantsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return drivers.filter((driver) => {
      const matchesSearch =
        !needle ||
        driver.full_name.toLowerCase().includes(needle) ||
        driver.phone.includes(searchQuery) ||
        Boolean(driver.license_number?.includes(searchQuery));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? driver.is_active : !driver.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

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
          })
          .eq('id', editingId);
        if (err) throw err;
        setSuccess('Driver updated successfully');
      } else {
        const { error: err } = await supabase.from('drivers').insert([{
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
      const { error: err } = await supabase.from('drivers').delete().eq('id', driverId);
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
      const { error: err } = await supabase.from('drivers').update({ is_active: !currentStatus }).eq('id', driverId);
      if (err) throw err;
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver');
    }
  };

  const isLicenseExpired = (expiryDate: string | null) => Boolean(expiryDate && new Date(expiryDate) < new Date());

  return (
    <>
      <AdminPageHeader
        title="Drivers"
        description="Every driver record across fleets. Set or reset a PIN from the row menu."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4" />
                Add driver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit driver' : 'Create driver'}</DialogTitle>
                <DialogDescription>{editingId ? 'Update driver information' : 'Add a new driver to the system'}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingId && (
                  <div className="space-y-2">
                    <Label htmlFor="tenant_id">Fleet company *</Label>
                    <select id="tenant_id" value={formData.tenant_id} onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })} className={adminSelectClass} required>
                      <option value="">Select a fleet company</option>
                      {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name *</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_number">License number</Label>
                  <Input id="license_number" value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_expiry">License expiry</Label>
                  <Input id="license_expiry" type="date" value={formData.license_expiry} onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id_number">ID number</Label>
                  <Input id="id_number" value={formData.id_number} onChange={(e) => setFormData({ ...formData, id_number: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AdminFeedback error={error} success={success} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search name, phone, or license…" />
        <select className={`${adminSelectClass} sm:w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <AdminRecordList
        rows={filteredDrivers}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No drivers found"
        emptyDescription="Add a driver or change the search."
        columns={[
          { id: 'name', header: 'Driver', cell: (row) => <span className="font-medium">{row.full_name}</span> },
          { id: 'phone', header: 'Phone', cell: (row) => row.phone },
          { id: 'fleet', header: 'Fleet', cell: (row) => row.tenants?.name || '—' },
          { id: 'license', header: 'License', cell: (row) => row.license_number || '—', hideOnMobile: true },
          {
            id: 'expiry',
            header: 'Expiry',
            hideOnMobile: true,
            cell: (row) => (
              <span className={isLicenseExpired(row.license_expiry) ? 'font-medium text-rose-600' : ''}>
                {row.license_expiry ? `${formatDate(row.license_expiry)}${isLicenseExpired(row.license_expiry) ? ' (expired)' : ''}` : '—'}
              </span>
            ),
          },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
        ]}
        actions={(driver) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setResetDriver(driver)} className="cursor-pointer min-h-11">
                <KeyRound className="h-4 w-4 mr-2" /> Set / reset PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenDialog(driver)} className="cursor-pointer min-h-11">
                <Edit className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleDriverStatus(driver.id, driver.is_active)} className="cursor-pointer min-h-11">
                {driver.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(driver.id)} className="cursor-pointer min-h-11 text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <PinResetDialog
        open={Boolean(resetDriver)}
        onOpenChange={(open) => { if (!open) setResetDriver(null) }}
        title="Reset driver PIN"
        description="Set a new PIN for this driver across fleets. The PIN is shown once and is never stored in plain text."
        name={resetDriver?.full_name}
        submit={async ({ pin, generate }) => {
          if (!resetDriver) return { error: 'No driver selected', generated: false }
          const response = await fetch('/api/admin/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'driver', driverId: resetDriver.id, pin, generate }),
          })
          return response.json()
        }}
      />
    </>
  );
}
