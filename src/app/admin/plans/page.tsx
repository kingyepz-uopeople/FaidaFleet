'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoreHorizontal, Trash2, Edit, Plus } from '@/components/icons';
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
  formatKes,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewPlans } from '@/lib/admin-preview';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type Plan = Database['public']['Tables']['plans']['Row'];

type PlanForm = {
  name: string;
  price: string;
  description: string;
  max_vehicles: string;
  max_drivers: string;
  features: string;
};

const EMPTY_FORM: PlanForm = {
  name: '',
  price: '',
  description: '',
  max_vehicles: '',
  max_drivers: '',
  features: '',
};

export default function PlansPage() {
  const preview = isAdminUiPreview();
  const [plans, setPlans] = useState<Plan[]>(preview ? (previewPlans as unknown as Plan[]) : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PlanForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    void fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setPlans(previewPlans as unknown as Plan[]);
        return;
      }
      const { data, error: err } = await supabase.from('plans').select('*').order('price', { ascending: true });
      if (err) throw err;
      setPlans(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return plans.filter((plan) => plan.name.toLowerCase().includes(needle) || (plan.description || '').toLowerCase().includes(needle));
  }, [searchQuery, plans]);

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingId(plan.id);
      setFormData({
        name: plan.name,
        price: plan.price.toString(),
        description: plan.description || '',
        max_vehicles: plan.max_vehicles.toString(),
        max_drivers: plan.max_drivers.toString(),
        features: (plan.features || []).join(', '),
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
      const features = formData.features.split(',').map((f) => f.trim()).filter(Boolean);
      const payload = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        description: formData.description.trim(),
        max_vehicles: parseInt(formData.max_vehicles, 10),
        max_drivers: parseInt(formData.max_drivers, 10),
        features,
      };
      if (editingId) {
        assertUuid(editingId, 'Plan');
        await requireRows(
          supabase.from('plans').update(payload).eq('id', editingId).select('id'),
          'plan',
          'update',
        );
        toast({ title: 'Plan updated', description: `${payload.name} was saved.` });
      } else {
        await requireRows(
          supabase.from('plans').insert([payload]).select('id'),
          'plan',
          'create',
        );
        toast({ title: 'Plan created', description: `${payload.name} is now available.` });
      }
      setDialogOpen(false);
      await fetchPlans();
    } catch (err) {
      toast({
        title: editingId ? 'Could not update plan' : 'Could not create plan',
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
      assertUuid(deleteTarget.id, 'Plan');
      await requireRows(
        supabase.from('plans').delete().eq('id', deleteTarget.id).select('id'),
        'plan',
        'delete',
      );
      toast({ title: 'Plan deleted', description: `${deleteTarget.name} was removed.` });
      setDeleteTarget(null);
      await fetchPlans();
    } catch (err) {
      toast({
        title: 'Could not delete plan',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    try {
      assertUuid(planId, 'Plan');
      await requireRows(
        supabase.from('plans').update({ is_active: !currentStatus }).eq('id', planId).select('id'),
        'plan',
        'update',
      );
      await fetchPlans();
    } catch (err) {
      toast({
        title: 'Could not update plan',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Plans"
        description="Pricing tiers and feature limits for fleet subscriptions."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        }
      />

      <AdminFeedback error={error} />
      <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search plans…" />

      <AdminRecordList
        rows={filteredPlans}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No plans found"
        columns={[
          { id: 'name', header: 'Plan', cell: (row) => <span className="font-medium">{row.name}</span> },
          { id: 'price', header: 'Price', cell: (row) => row.price === 0 ? 'Free' : formatKes(row.price) },
          { id: 'vehicles', header: 'Vehicles', cell: (row) => String(row.max_vehicles), hideOnMobile: true },
          { id: 'drivers', header: 'Drivers', cell: (row) => String(row.max_drivers), hideOnMobile: true },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
        ]}
        actions={(plan) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenDialog(plan)} className="min-h-11 cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePlanStatus(plan.id, Boolean(plan.is_active))} className="min-h-11 cursor-pointer">{plan.is_active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteTarget(plan)} className="min-h-11 cursor-pointer text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SafeDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <SafeDialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit plan' : 'Create plan'}</DialogTitle>
            <DialogDescription>{editingId ? 'Update plan details' : 'Add a new subscription plan'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Plan name *</Label><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="price">Monthly price (KES) *</Label><Input id="price" type="number" inputMode="decimal" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="description">Description *</Label><Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="max_vehicles">Max vehicles *</Label><Input id="max_vehicles" type="number" inputMode="numeric" min="0" value={formData.max_vehicles} onChange={(e) => setFormData({ ...formData, max_vehicles: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="max_drivers">Max drivers *</Label><Input id="max_drivers" type="number" inputMode="numeric" min="0" value={formData.max_drivers} onChange={(e) => setFormData({ ...formData, max_drivers: e.target.value })} required /></div>
            <div className="space-y-2">
              <Label htmlFor="features">Features (comma-separated) *</Label>
              <textarea id="features" value={formData.features} onChange={(e) => setFormData({ ...formData, features: e.target.value })} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" required />
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
        title="Delete plan?"
        description={deleteTarget ? `${deleteTarget.name} will be permanently removed. Existing subscriptions are not changed.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {filteredPlans.map((plan) => (
          <Card key={plan.id} className={plan.is_active ? '' : 'opacity-60'}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold">{plan.price === 0 ? 'Free' : formatKes(plan.price)}<span className="text-sm font-normal text-muted-foreground"> /month</span></p>
              <p className="text-sm text-muted-foreground">{plan.max_vehicles} vehicles · {plan.max_drivers} drivers</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(plan.features || []).map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
