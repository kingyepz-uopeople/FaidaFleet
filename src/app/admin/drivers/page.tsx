'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MoreHorizontal, Trash2, Edit, Plus, KeyRound } from '@/components/icons';
import { PinResetDialog } from '@/components/pin-reset-dialog';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow } from '@/lib/db';
import { driverPhoneEditError } from '@/lib/driver-phone-edit';
import { toastError, toastSuccess } from '@/lib/toast';
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

const EMPTY_FORM = {
  full_name: '',
  phone: '',
  license_number: '',
  license_expiry: '',
  id_number: '',
  tenant_id: '',
};

export default function AllDriversPage() {
  const preview = isAdminUiPreview();
  const [drivers, setDrivers] = useState<Driver[]>(preview ? previewDrivers : []);
  const [tenants, setTenants] = useState<Tenant[]>(
    preview ? previewTenants.map((tenant) => ({ id: tenant.id, name: tenant.name })) : [],
  );
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetDriver, setResetDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setDrivers(previewDrivers);
        setTenants(previewTenants.map((tenant) => ({ id: tenant.id, name: tenant.name })));
        return;
      }
      const [driversRes, tenantsRes] = await Promise.all([
        supabase.from('drivers').select('*, tenants(name)').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (driversRes.error) throw driversRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      setDrivers((driversRes.data || []) as Driver[]);
      setTenants(tenantsRes.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load drivers';
      setError(message);
      toastError(message, 'Could not load drivers');
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
        Boolean(driver.license_number?.toLowerCase().includes(needle));
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? driver.is_active : !driver.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, tenant_id: tenants[0]?.id || '' });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setFormData({
      full_name: driver.full_name,
      phone: driver.phone,
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      id_number: driver.id_number || '',
      tenant_id: driver.tenant_id,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (!formData.full_name.trim()) throw new Error('Driver name is required');
      if (!formData.phone.trim()) throw new Error('Phone number is required');

      const payload = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        license_number: formData.license_number.trim() || null,
        license_expiry: formData.license_expiry || null,
        id_number: formData.id_number.trim() || null,
      };

      const result = editingId
        ? await supabase.from('drivers').update(payload).eq('id', editingId).select('id')
        : await supabase
            .from('drivers')
            .insert([{ ...payload, tenant_id: formData.tenant_id, is_active: true }])
            .select('id');

      const originalPhone = drivers.find((driver) => driver.id === editingId)?.phone;
      const phoneError = driverPhoneEditError(result.error?.message, originalPhone, payload.phone);
      if (phoneError) throw new Error(phoneError);
      assertMutationRow(result, editingId ? 'Could not update the driver' : 'Could not create the driver');
      setSuccess(editingId ? 'Driver updated.' : 'Driver created.');
      toastSuccess(editingId ? 'Driver updated.' : 'Driver created.', 'Saved');
      setDialogOpen(false);
      await fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the driver';
      setFormError(message);
      toastError(message, 'Could not save the driver');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (driver: Driver) => {
    if (!window.confirm(`Delete ${driver.full_name}? Their collections stay in the fleet history.`)) return;
    try {
      const result = await supabase.from('drivers').delete().eq('id', driver.id).select('id');
      assertMutation(result, 'Could not delete the driver');
      setSuccess('Driver deleted.');
      toastSuccess('Driver deleted.', 'Deleted');
      await fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      toastError(err, 'Could not delete the driver');
    }
  };

  const toggleDriverStatus = async (driver: Driver) => {
    try {
      const result = await supabase
        .from('drivers')
        .update({ is_active: !driver.is_active })
        .eq('id', driver.id)
        .select('id');
      assertMutation(result, 'Could not update the driver');
      toastSuccess(driver.is_active ? 'Driver deactivated.' : 'Driver activated.');
      await fetchData();
    } catch (err) {
      toastError(err, 'Could not update the driver');
    }
  };

  const isLicenseExpired = (expiryDate: string | null) => Boolean(expiryDate && new Date(expiryDate) < new Date());

  return (
    <>
      <AdminPageHeader
        title="Drivers"
        description="Every driver record across fleets. Set or reset a PIN from the row menu."
        actions={
          <Button type="button" onClick={openCreate} disabled={tenants.length === 0}>
            <Plus className="h-4 w-4" />
            Add driver
          </Button>
        }
      />

      <AdminFeedback error={error} success={success} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search name, phone, or license…" />
        <NativeSelect
          className="sm:w-44"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </NativeSelect>
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
                {row.license_expiry
                  ? `${formatDate(row.license_expiry)}${isLicenseExpired(row.license_expiry) ? ' (expired)' : ''}`
                  : '—'}
              </span>
            ),
          },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
        ]}
        actions={(driver) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger>
                <MoreHorizontal className="h-4 w-4" />
              </RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setResetDriver(driver)} className="min-h-11 cursor-pointer">
                <KeyRound className="mr-2 h-4 w-4" /> Set / reset PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(driver)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleDriverStatus(driver)} className="min-h-11 cursor-pointer">
                {driver.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(driver)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? 'Edit driver' : 'Create driver'}
        description={editingId ? 'Update driver information.' : 'Add a driver to a fleet. Set a PIN afterwards so they can sign in.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingId && (
            <div className="space-y-2">
              <Label htmlFor="tenant_id">Fleet company *</Label>
              <NativeSelect
                id="tenant_id"
                value={formData.tenant_id}
                onChange={(event) => setFormData({ ...formData, tenant_id: event.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select a fleet company</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name *</Label>
            <Input id="full_name" value={formData.full_name} onChange={(event) => setFormData({ ...formData, full_name: event.target.value })} required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="0712345678" required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="license_number">License number</Label>
            <Input id="license_number" value={formData.license_number} onChange={(event) => setFormData({ ...formData, license_number: event.target.value })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="license_expiry">License expiry</Label>
            <Input id="license_expiry" type="date" value={formData.license_expiry} onChange={(event) => setFormData({ ...formData, license_expiry: event.target.value })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_number">ID number</Label>
            <Input id="id_number" value={formData.id_number} onChange={(event) => setFormData({ ...formData, id_number: event.target.value })} disabled={submitting} />
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
              {submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}
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
        description="Set a new PIN for this driver across fleets. The PIN is shown once and is never stored in plain text."
        name={resetDriver?.full_name}
        submit={async ({ pin, generate }) => {
          if (!resetDriver) return { error: 'No driver selected', generated: false };
          const response = await fetch('/api/admin/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'driver', driverId: resetDriver.id, pin, generate }),
          });
          return response.json();
        }}
      />
    </>
  );
}
