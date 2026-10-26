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
import { MoreHorizontal, Trash2, Edit, PlusCircle, KeyRound } from '@/components/icons';
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

type Tenant = {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
};

const PLANS = ['starter', 'pro', 'enterprise'];

export default function FleetOwnersPage() {
  const preview = isAdminUiPreview();
  const [tenants, setTenants] = useState<Tenant[]>(preview ? previewTenants : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetTenant, setResetTenant] = useState<Tenant | null>(null);
  const [resetPhone, setResetPhone] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    business_name: '',
    email: '',
    phone: '',
    plan: 'starter',
  });
  const supabase = createClient();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setTenants(previewTenants);
        return;
      }
      const { data, error: err } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (err) throw err;
      setTenants(data || []);
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
        plan: tenant.plan,
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', business_name: '', email: '', phone: '', plan: 'starter' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        const { error: err } = await supabase.from('tenants').update({
          name: formData.name,
          business_name: formData.business_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          plan: formData.plan as 'starter' | 'pro' | 'enterprise',
        }).eq('id', editingId);
        if (err) throw err;
        setSuccess('Fleet owner updated successfully');
      } else {
        const { error: err } = await supabase.from('tenants').insert([{
          name: formData.name,
          business_name: formData.business_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          plan: formData.plan as 'starter' | 'pro' | 'enterprise',
          is_active: true,
        }]);
        if (err) throw err;
        setSuccess('Fleet owner created successfully');
      }
      setDialogOpen(false);
      await fetchTenants();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save fleet owner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tenantId: string) => {
    if (!window.confirm('Are you sure you want to delete this fleet owner? This action cannot be undone.')) return;
    try {
      const { error: err } = await supabase.from('tenants').delete().eq('id', tenantId);
      if (err) throw err;
      setSuccess('Fleet owner deleted successfully');
      await fetchTenants();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete fleet owner');
    }
  };

  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase.from('tenants').update({ is_active: !currentStatus }).eq('id', tenantId);
      if (err) throw err;
      await fetchTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update fleet owner');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Fleet owners"
        description="Companies on FaidaFleet. Set a PIN for owners who signed up without one."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-4 w-4" />
                Add fleet owner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
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
                  <select id="plan" value={formData.plan} onChange={(e) => setFormData({ ...formData, plan: e.target.value })} className={adminSelectClass} required>
                    {PLANS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
                  </select>
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
          { id: 'plan', header: 'Plan', cell: (row) => <StatusBadge tone={planTone(row.plan)}>{titleCase(row.plan)}</StatusBadge> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
          { id: 'joined', header: 'Joined', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
        ]}
        actions={(tenant) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setResetTenant(tenant); setResetPhone(tenant.phone || ''); }} className="cursor-pointer min-h-11">
                <KeyRound className="h-4 w-4 mr-2" /> Set / reset PIN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenDialog(tenant)} className="cursor-pointer min-h-11">
                <Edit className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)} className="cursor-pointer min-h-11">
                {tenant.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(tenant.id)} className="cursor-pointer min-h-11 text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
