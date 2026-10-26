'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type Driver = Database['public']['Tables']['drivers']['Row'] & {
  tenants?: { name: string } | null;
};

type Tenant = {
  id: string;
  name: string;
};

type DriverForm = {
  full_name: string;
  phone: string;
  license_number: string;
  license_expiry: string;
  id_number: string;
  tenant_id: string;
};

const EMPTY_FORM: DriverForm = {
  full_name: '',
  phone: '',
  license_number: '',
  license_expiry: '',
  id_number: '',
  tenant_id: '',
};

export default function AllDriversPage() {
  const preview = isAdminUiPreview();
  const [drivers, setDrivers] = useState<Driver[]>(preview ? (previewDrivers as unknown as Driver[]) : []);
  const [tenants, setTenants] = useState<Tenant[]>(preview ? previewTenants.map((t) => ({ id: t.id, name: t.name })) : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetDriver, setResetDriver] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<DriverForm>(EMPTY_FORM);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setDrivers(previewDrivers as unknown as Driver[]);
        setTenants(previewTenants.map((t) => ({ id: t.id, name: t.name })));
        return;
      }
      const [driversRes, tenantsRes] = await Promise.all([
        supabase.from('drivers').select('*, tenants(name)').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name').eq('is_active', true),
      ]);
      if (driversRes.error) throw driversRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      setDrivers((driversRes.data as unknown as Driver[]) || []);
      setTenants(tenantsRes.data || []);
      setError(null);
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
      setFormData({ ...EMPTY_FORM, tenant_id: tenants[0]?.id || '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        assertUuid(editingId, 'Driver');
        await requireRows(
          supabase
            .from('drivers')
            .update({
              full_name: formData.full_name.trim(),
              phone: formData.phone.trim(),
              license_number: formData.license_number.trim() || null,
              license_expiry: formData.license_expiry || null,
              id_number: formData.id_number.trim() || null,
            })
            .eq('id', editingId)
            .select('id'),
          'driver',
          'update',
        );
        toast({ title: 'Driver updated', description: `${formData.full_name} was saved.` });
      } else {
        assertUuid(formData.tenant_id, 'Fleet company');
        await requireRows(
          supabase
            .from('drivers')
            .insert([{
              tenant_id: formData.tenant_id,
              full_name: formData.full_name.trim(),
              phone: formData.phone.trim(),
              license_number: formData.license_number.trim() || null,
              license_expiry: formData.license_expiry || null,
              id_number: formData.id_number.trim() || null,
              is_active: true,
            }])
            .select('id'),
          'driver',
          'create',
        );
        toast({ title: 'Driver created', description: 'Use Set / reset PIN to create their login.' });
      }
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast({
        title: editingId ? 'Could not update driver' : 'Could not create driver',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      assertUuid(deleteTarget.id, 'Driver');
      await requireRows(
        supabase.from('drivers').delete().eq('id', deleteTarget.id).select('id'),
        'driver',
        'delete',
      );
      toast({ title: 'Driver deleted', description: `${deleteTarget.full_name} was removed.` });
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      toast({
        title: 'Could not delete driver',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    try {
      assertUuid(driverId, 'Driver');
      await requireRows(
        supabase.from('drivers').update({ is_active: !currentStatus }).eq('id', driverId).select('id'),
        'driver',
        'update',
      );
      await fetchData();
    } catch (err) {
      toast({
        title: 'Could not update driver',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const isLicenseExpired = (expiryDate: string | null) => Boolean(expiryDate && new Date(expiryDate) < new Date());

  return (
    <>
      <AdminPageHeader
        title="Drivers"
        description="Every driver record across fleets. Set or reset a PIN from the row menu."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4" />
            Add driver
          </Button>
        }
      />

      <AdminFeedback error={error} />
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
              <DropdownMenuItem onClick={() => setResetDriver(driver)} className="min-h-11 cursor-pointer">
                <KeyRound className="mr-2 h-4 w-4" /> Set / reset PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenDialog(driver)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleDriverStatus(driver.id, driver.is_active)} className="min-h-11 cursor-pointer">
                {driver.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteTarget(driver)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SafeDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <SafeDialogContent className="max-w-md">
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete driver?"
        description={deleteTarget ? `${deleteTarget.full_name} will be permanently removed, including their assignments.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
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
