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
  planTone,
  titleCase,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewTenants } from '@/lib/admin-preview';

type Tenant = {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  plan: 'starter' | 'pro' | 'enterprise';
  is_active: boolean;
  created_at: string;
};

const PLANS = ['starter', 'pro', 'enterprise'] as const;

const EMPTY_FORM = {
  name: '',
  business_name: '',
  email: '',
  phone: '',
  plan: 'starter' as Tenant['plan'],
};

export default function FleetOwnersPage() {
  const preview = isAdminUiPreview();
  const [tenants, setTenants] = useState<Tenant[]>(preview ? previewTenants : []);
  const [ownerTenantIds, setOwnerTenantIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetTenant, setResetTenant] = useState<Tenant | null>(null);
  const [resetPhone, setResetPhone] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setTenants(previewTenants);
        setOwnerTenantIds(new Set(['t1', 't2']));
        return;
      }
      const [tenantsRes, ownersRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('memberships').select('tenant_id').eq('role', 'owner').eq('is_active', true),
      ]);
      if (tenantsRes.error) throw tenantsRes.error;
      if (ownersRes.error) throw ownersRes.error;
      setTenants((tenantsRes.data || []) as Tenant[]);
      setOwnerTenantIds(new Set((ownersRes.data || []).map((row) => row.tenant_id)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load fleet owners';
      setError(message);
      toastError(message, 'Could not load fleet owners');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(needle) ||
        tenant.business_name?.toLowerCase().includes(needle) ||
        tenant.email?.toLowerCase().includes(needle),
    );
  }, [searchQuery, tenants]);

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setFormData({
      name: tenant.name,
      business_name: tenant.business_name || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      plan: tenant.plan,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (!formData.name.trim()) throw new Error('Company name is required');

      const payload = {
        name: formData.name.trim(),
        business_name: formData.business_name.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        plan: formData.plan,
      };

      const result = editingId
        ? await supabase.from('tenants').update(payload).eq('id', editingId).select('id')
        : await supabase.from('tenants').insert([{ ...payload, is_active: true }]).select('id');

      assertMutationRow(result, editingId ? 'Could not update the fleet owner' : 'Could not create the fleet owner');
      setSuccess(editingId ? 'Fleet owner updated.' : 'Fleet owner created. Set a PIN so they can sign in.');
      toastSuccess(editingId ? 'Fleet owner updated.' : 'Fleet owner created.', 'Saved');
      setDialogOpen(false);
      await fetchTenants();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the fleet owner';
      setFormError(message);
      toastError(message, 'Could not save the fleet owner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!window.confirm(`Delete ${tenant.name}? Every vehicle, driver, and collection in this fleet is removed too.`)) return;
    try {
      const result = await supabase.from('tenants').delete().eq('id', tenant.id).select('id');
      assertMutation(result, 'Could not delete the fleet owner');
      setSuccess('Fleet owner deleted.');
      toastSuccess('Fleet owner deleted.', 'Deleted');
      await fetchTenants();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      toastError(err, 'Could not delete the fleet owner');
    }
  };

  const toggleTenantStatus = async (tenant: Tenant) => {
    try {
      const result = await supabase
        .from('tenants')
        .update({ is_active: !tenant.is_active })
        .eq('id', tenant.id)
        .select('id');
      assertMutation(result, 'Could not update the fleet owner');
      toastSuccess(tenant.is_active ? 'Fleet deactivated.' : 'Fleet activated.');
      await fetchTenants();
    } catch (err) {
      toastError(err, 'Could not update the fleet owner');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Fleet owners"
        description="Companies on FaidaFleet. Set a PIN for owners who signed up without one."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add fleet owner
          </Button>
        }
      />

      <AdminFeedback error={error} success={success} />
      <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, business, or email…" />

      <AdminRecordList
        rows={filteredTenants}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No fleet owners found"
        emptyDescription="Add a fleet owner to get started."
        columns={[
          { id: 'name', header: 'Company', cell: (row) => <span className="font-medium">{row.name}</span> },
          { id: 'business', header: 'Business', cell: (row) => row.business_name || '—', hideOnMobile: true },
          { id: 'email', header: 'Email', cell: (row) => row.email || '—', hideOnMobile: true },
          { id: 'phone', header: 'Phone', cell: (row) => row.phone || '—' },
          {
            id: 'login',
            header: 'Owner login',
            cell: (row) =>
              ownerTenantIds.has(row.id) ? (
                <StatusBadge tone="success">Linked</StatusBadge>
              ) : (
                <StatusBadge tone="warning">No owner</StatusBadge>
              ),
          },
          { id: 'plan', header: 'Plan', cell: (row) => <StatusBadge tone={planTone(row.plan)}>{titleCase(row.plan)}</StatusBadge> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
          { id: 'joined', header: 'Joined', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
        ]}
        actions={(tenant) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger>
                <MoreHorizontal className="h-4 w-4" />
              </RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setResetTenant(tenant);
                  setResetPhone(tenant.phone || '');
                }}
                className="min-h-11 cursor-pointer"
              >
                <KeyRound className="mr-2 h-4 w-4" /> Set / reset PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(tenant)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleTenantStatus(tenant)} className="min-h-11 cursor-pointer">
                {tenant.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(tenant)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {/* Rendered by the page, never inside the header actions. */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? 'Edit fleet owner' : 'Create fleet owner'}
        description={
          editingId
            ? 'Update the company details for this fleet.'
            : 'Add a fleet company. Set a PIN afterwards so the owner can sign in.'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company name *</Label>
            <Input id="name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input id="business_name" value={formData.business_name} onChange={(event) => setFormData({ ...formData, business_name: event.target.value })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="off" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="0712345678" disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">Plan *</Label>
            <NativeSelect
              id="plan"
              value={formData.plan}
              onChange={(event) => setFormData({ ...formData, plan: event.target.value as Tenant['plan'] })}
              required
              disabled={submitting}
            >
              {PLANS.map((plan) => (
                <option key={plan} value={plan}>{titleCase(plan)}</option>
              ))}
            </NativeSelect>
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
        open={Boolean(resetTenant)}
        onOpenChange={(open) => {
          if (!open) setResetTenant(null);
        }}
        title="Set fleet owner PIN"
        description="Create or reset the owner login PIN. If this fleet has no login yet, enter the owner's Kenyan phone number. The PIN is shown once."
        name={resetTenant?.name}
        extraFields={
          <div className="space-y-2">
            <Label htmlFor="owner-reset-phone">Owner phone</Label>
            <Input
              id="owner-reset-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712345678"
              value={resetPhone}
              onChange={(event) => setResetPhone(event.target.value)}
            />
          </div>
        }
        submit={async ({ pin, generate }) => {
          if (!resetTenant) return { error: 'No fleet selected', generated: false };
          const response = await fetch('/api/admin/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'fleet_owner', tenantId: resetTenant.id, phone: resetPhone, pin, generate }),
          });
          const payload = await response.json().catch(() => ({ error: 'Could not set the PIN', generated: false }));
          if (response.ok) await fetchTenants();
          return payload;
        }}
      />
    </>
  );
}
