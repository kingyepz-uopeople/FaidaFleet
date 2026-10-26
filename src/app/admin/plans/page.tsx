'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { MoreHorizontal, Trash2, Edit, PlusCircle } from '@/components/icons';
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

type Plan = {
  id: string;
  name: string;
  price: number;
  description: string;
  max_vehicles: number;
  max_drivers: number;
  features: string[];
  is_active: boolean;
  created_at: string;
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
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    max_vehicles: '',
    max_drivers: '',
    features: '',
  });
  const supabase = createClient();

  useEffect(() => {
    fetchPlans();
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
      setFormData({ name: '', price: '', description: '', max_vehicles: '', max_drivers: '', features: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const features = formData.features.split(',').map((f) => f.trim()).filter(Boolean);
      if (editingId) {
        const { error: err } = await supabase.from('plans').update({
          name: formData.name,
          price: parseFloat(formData.price),
          description: formData.description,
          max_vehicles: parseInt(formData.max_vehicles),
          max_drivers: parseInt(formData.max_drivers),
          features,
        }).eq('id', editingId);
        if (err) throw err;
        setSuccess('Plan updated successfully');
      } else {
        const { error: err } = await supabase.from('plans').insert([{
          name: formData.name,
          price: parseFloat(formData.price),
          description: formData.description,
          max_vehicles: parseInt(formData.max_vehicles),
          max_drivers: parseInt(formData.max_drivers),
          features,
        }]);
        if (err) throw err;
        setSuccess('Plan created successfully');
      }
      setDialogOpen(false);
      await fetchPlans();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      const { error: err } = await supabase.from('plans').delete().eq('id', planId);
      if (err) throw err;
      setSuccess('Plan deleted successfully');
      await fetchPlans();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase.from('plans').update({ is_active: !currentStatus }).eq('id', planId);
      if (err) throw err;
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Plans"
        description="Pricing tiers and feature limits for fleet subscriptions."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-4 w-4" />
                Add plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit plan' : 'Create plan'}</DialogTitle>
                <DialogDescription>{editingId ? 'Update plan details' : 'Add a new subscription plan'}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="name">Plan name *</Label><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="price">Monthly price (KES) *</Label><Input id="price" type="number" inputMode="decimal" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="description">Description *</Label><Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="max_vehicles">Max vehicles *</Label><Input id="max_vehicles" type="number" inputMode="numeric" value={formData.max_vehicles} onChange={(e) => setFormData({ ...formData, max_vehicles: e.target.value })} required /></div>
                <div className="space-y-2"><Label htmlFor="max_drivers">Max drivers *</Label><Input id="max_drivers" type="number" inputMode="numeric" value={formData.max_drivers} onChange={(e) => setFormData({ ...formData, max_drivers: e.target.value })} required /></div>
                <div className="space-y-2">
                  <Label htmlFor="features">Features (comma-separated) *</Label>
                  <textarea id="features" value={formData.features} onChange={(e) => setFormData({ ...formData, features: e.target.value })} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" required />
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
              <DropdownMenuItem onClick={() => handleOpenDialog(plan)} className="cursor-pointer min-h-11"><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePlanStatus(plan.id, plan.is_active)} className="cursor-pointer min-h-11">{plan.is_active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="cursor-pointer min-h-11 text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
