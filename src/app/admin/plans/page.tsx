'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MoreHorizontal, Trash2, Edit, Plus } from '@/components/icons';
import { FormDialog } from '@/components/form-dialog';
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
  formatKes,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewPlans } from '@/lib/admin-preview';

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  max_vehicles: number;
  max_drivers: number;
  features: string[];
  is_active: boolean;
  created_at: string;
};

const EMPTY_FORM = {
  name: '',
  price: '',
  description: '',
  max_vehicles: '',
  max_drivers: '',
  features: '',
};

export default function PlansPage() {
  const preview = isAdminUiPreview();
  const [plans, setPlans] = useState<Plan[]>(preview ? previewPlans : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setPlans(previewPlans);
        return;
      }
      const { data, error: err } = await supabase.from('plans').select('*').order('price', { ascending: true });
      if (err) throw err;
      setPlans((data || []) as Plan[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load plans';
      setError(message);
      toastError(message, 'Could not load plans');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return plans.filter(
      (plan) => plan.name.toLowerCase().includes(needle) || (plan.description || '').toLowerCase().includes(needle),
    );
  }, [searchQuery, plans]);

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setFormData({
      name: plan.name,
      price: plan.price.toString(),
      description: plan.description || '',
      max_vehicles: plan.max_vehicles.toString(),
      max_drivers: plan.max_drivers.toString(),
      features: (plan.features || []).join(', '),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (!formData.name.trim()) throw new Error('Plan name is required');
      const price = Number.parseFloat(formData.price);
      const maxVehicles = Number.parseInt(formData.max_vehicles, 10);
      const maxDrivers = Number.parseInt(formData.max_drivers, 10);
      if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid price');
      if (!Number.isFinite(maxVehicles) || maxVehicles < 1) throw new Error('Max vehicles must be at least 1');
      if (!Number.isFinite(maxDrivers) || maxDrivers < 1) throw new Error('Max drivers must be at least 1');

      const payload = {
        name: formData.name.trim(),
        price,
        description: formData.description.trim() || null,
        max_vehicles: maxVehicles,
        max_drivers: maxDrivers,
        features: formData.features.split(',').map((feature) => feature.trim()).filter(Boolean),
      };

      const result = editingId
        ? await supabase.from('plans').update(payload).eq('id', editingId).select('id')
        : await supabase.from('plans').insert([payload]).select('id');

      assertMutationRow(result, editingId ? 'Could not update the plan' : 'Could not create the plan');
      setSuccess(editingId ? 'Plan updated.' : 'Plan created.');
      toastSuccess(editingId ? 'Plan updated.' : 'Plan created.', 'Saved');
      setDialogOpen(false);
      await fetchPlans();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the plan';
      setFormError(message);
      toastError(message, 'Could not save the plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!window.confirm(`Delete the ${plan.name} plan? Fleets on this plan keep their data.`)) return;
    try {
      const result = await supabase.from('plans').delete().eq('id', plan.id).select('id');
      assertMutation(result, 'Could not delete the plan');
      setSuccess('Plan deleted.');
      toastSuccess('Plan deleted.', 'Deleted');
      await fetchPlans();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      toastError(err, 'Could not delete the plan');
    }
  };

  const togglePlanStatus = async (plan: Plan) => {
    try {
      const result = await supabase
        .from('plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id)
        .select('id');
      assertMutation(result, 'Could not update the plan');
      toastSuccess(plan.is_active ? 'Plan deactivated.' : 'Plan activated.');
      await fetchPlans();
    } catch (err) {
      toastError(err, 'Could not update the plan');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Plans"
        description="Pricing tiers and feature limits for fleet subscriptions."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        }
      />

      <AdminFeedback error={error} success={success} />
      <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search plans…" />

      <AdminRecordList
        rows={filteredPlans}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No plans found"
        emptyDescription="Create a plan to describe what fleets get."
        columns={[
          { id: 'name', header: 'Plan', cell: (row) => <span className="font-medium">{row.name}</span> },
          { id: 'price', header: 'Price', cell: (row) => (row.price === 0 ? 'Free' : formatKes(row.price)) },
          { id: 'vehicles', header: 'Vehicles', cell: (row) => String(row.max_vehicles), hideOnMobile: true },
          { id: 'drivers', header: 'Drivers', cell: (row) => String(row.max_drivers), hideOnMobile: true },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
        ]}
        actions={(plan) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger>
                <MoreHorizontal className="h-4 w-4" />
              </RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(plan)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePlanStatus(plan)} className="min-h-11 cursor-pointer">
                {plan.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(plan)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? 'Edit plan' : 'Create plan'}
        description="Limits are enforced when a fleet adds vehicles or drivers."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Plan name *</Label>
            <Input id="name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Monthly price (KES) *</Label>
            <Input id="price" type="number" inputMode="decimal" step="0.01" min="0" value={formData.price} onChange={(event) => setFormData({ ...formData, price: event.target.value })} required disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input id="description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} required disabled={submitting} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max_vehicles">Max vehicles *</Label>
              <Input id="max_vehicles" type="number" inputMode="numeric" min="1" value={formData.max_vehicles} onChange={(event) => setFormData({ ...formData, max_vehicles: event.target.value })} required disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_drivers">Max drivers *</Label>
              <Input id="max_drivers" type="number" inputMode="numeric" min="1" value={formData.max_drivers} onChange={(event) => setFormData({ ...formData, max_drivers: event.target.value })} required disabled={submitting} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="features">Features (comma-separated) *</Label>
            <textarea
              id="features"
              value={formData.features}
              onChange={(event) => setFormData({ ...formData, features: event.target.value })}
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              required
              disabled={submitting}
            />
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
    </>
  );
}
