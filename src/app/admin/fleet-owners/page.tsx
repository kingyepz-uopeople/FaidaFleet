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
  planTone,
  titleCase,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewTenants } from '@/lib/admin-preview';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type Tenant = Database['public']['Tables']['tenants']['Row'];
type Plan = NonNullable<Tenant['plan']>;

const PLANS: Plan[] = ['starter', 'pro', 'enterprise'];

type TenantForm = {
  name: string;
  business_name: string;
  email: string;
  phone: string;
  plan: Plan;
};

const EMPTY_FORM: TenantForm = { name: '', business_name: '', email: '', phone: '', plan: 'starter' };

export default function FleetOwnersPage() {
  const preview = isAdminUiPreview();
  const [tenants, setTenants] = useState<Tenant[]>(preview ? (previewTenants as unknown as Tenant[]) : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetTenant, setResetTenant] = useState<Tenant | null>(null);
  const [resetPhone, setResetPhone] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<TenantForm>(EMPTY_FORM);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    void fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setTenants(previewTenants as unknown as Tenant[]);
        return;
      }
      const { data, error: err } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (err) throw err;
      setTenants(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fleet owners');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return tenants.filter((tenant) =>
      tenant.name.toLowerCase().includes(needle) ||
      tenant.business_name?.toLowerCase().includes(needle) ||
      tenant.email?.toLowerCase().includes(needle),
    );
  }, [searchQuery, tenants]);

  const handleOpenDialog = (tenant?: Tenant) => {
    if (tenant) {
      setEditingId(tenant.id);
      setFormData({
        name: tenant.name,
        business_name: tenant.business_name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        plan: (tenant.plan || 'starter') as Plan,
      });
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        assertUuid(editingId, 'Fleet owner');
        await requireRows(
          supabase.from('tenants').update({
            name: formData.name.trim(),
            business_name: formData.business_name.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            plan: formData.plan,
          }).eq('id', editingId).select('id'),
          'fleet owner',
          'update',
        );
        toast({ title: 'Fleet owner updated', description: `${formData.name} was saved.` });
      } else {
        await requireRows(
          supabase.from('tenants').insert([{
            name: formData.name.trim(),
            business_name: formData.business_name.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            plan: formData.plan,
            is_active: true,
          }]).select('id'),
          'fleet owner',
          'create',
        );
        toast({
          title: 'Fleet owner created',
          description: 'Open Set / reset PIN to create the owner login and membership.',
        });
      }
      setDialogOpen(false);
      await fetchTenants();
    } catch (err) {
      toast({
        title: editingId ? 'Could not update fleet owner' : 'Could not create fleet owner',
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
      assertUuid(deleteTarget.id, 'Fleet owner');
      await requireRows(
        supabase.from('tenants').delete().eq('id', deleteTarget.id).select('id'),
        'fleet owner',
        'delete',
      );
      toast({ title: 'Fleet owner deleted', description: `${deleteTarget.name} was removed.` });
      setDeleteTarget(null);
      await fetchTenants();
    } catch (err) {
      toast({
        title: 'Could not delete fleet owner',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      assertUuid(tenantId, 'Fleet owner');
      await requireRows(
        supabase.from('tenants').update({ is_active: !currentStatus }).eq('id', tenantId).select('id'),
        'fleet owner',
        'update',
      );
      await fetchTenants();
    } catch (err) {
      toast({
        title: 'Could not update fleet owner',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Fleet owners"
        description="Companies on FaidaFleet. Set a PIN for owners who signed up without one."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4" />
            Add fleet owner
          </Button>
        }
      />

      <AdminFeedback error={error} />
      <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, business, or email…" />

      <AdminRecordList
        rows={filteredTenants}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No fleet owners found"
        columns={[
          { id: 'name', header: 'Company', cell: (row) => <span className="font-medium">{row.name}</span> },
          { id: 'business', header: 'Business', cell: (row) => row.business_name || '—', hideOnMobile: true },
          { id: 'email', header: 'Email', cell: (row) => row.email || '—', hideOnMobile: true },
          { id: 'phone', header: 'Phone', cell: (row) => row.phone || '—' },
          { id: 'plan', header: 'Plan', cell: (row) => <StatusBadge tone={planTone(row.plan || 'starter')}>{titleCase(row.plan || 'starter')}</StatusBadge> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
          { id: 'joined', header: 'Joined', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
        ]}
        actions={(tenant) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setResetTenant(tenant); setResetPhone(tenant.phone || ''); }} className="min-h-11 cursor-pointer">
                <KeyRound className="mr-2 h-4 w-4" /> Set / reset PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenDialog(tenant)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)} className="min-h-11 cursor-pointer">
                {tenant.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteTarget(tenant)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SafeDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <SafeDialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit fleet owner' : 'Create fleet owner'}</DialogTitle>
            <DialogDescription>{editingId ? 'Update fleet owner information' : 'Add a new fleet company. They will not have a PIN until you set one.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name</Label>
              <Input id="business_name" value={formData.business_name} onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan *</Label>
              <select id="plan" value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value as Plan })} className={adminSelectClass} required>
                {PLANS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </select>
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
        title="Delete fleet owner?"
        description={deleteTarget ? `${deleteTarget.name} and its related records will be permanently removed. This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      <PinResetDialog
        open={Boolean(resetTenant)}
        onOpenChange={(open) => { if (!open) setResetTenant(null) }}
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
              onChange={(e) => setResetPhone(e.target.value)}
            />
          </div>
        }
        submit={async ({ pin, generate }) => {
          if (!resetTenant) return { error: 'No fleet selected', generated: false }
          const response = await fetch('/api/admin/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'fleet_owner', tenantId: resetTenant.id, phone: resetPhone, pin, generate }),
          })
          return response.json()
        }}
      />
    </>
  );
}
