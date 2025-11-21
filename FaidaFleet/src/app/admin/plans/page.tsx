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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const filtered = plans.filter((plan) =>
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredPlans(filtered);
  }, [searchQuery, plans]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('plans')
        .select('*')
        .order('price', { ascending: true });

      if (err) throw err;
      setPlans(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  };

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
      setFormData({
        name: '',
        price: '',
        description: '',
        max_vehicles: '',
        max_drivers: '',
        features: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const features = formData.features.split(',').map((f) => f.trim()).filter((f) => f);

      if (editingId) {
        const { error: err } = await supabase
          .from('plans')
          .update({
            name: formData.name,
            price: parseFloat(formData.price),
            description: formData.description,
            max_vehicles: parseInt(formData.max_vehicles),
            max_drivers: parseInt(formData.max_drivers),
            features,
          } as any)
          .eq('id', editingId);

        if (err) throw err;
        setSuccess('Plan updated successfully');
      } else {
        const { error: err } = await supabase
          .from('plans')
          .insert([{
            name: formData.name,
            price: parseFloat(formData.price),
            description: formData.description,
            max_vehicles: parseInt(formData.max_vehicles),
            max_drivers: parseInt(formData.max_drivers),
            features,
          }] as any);

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
      const { error: err } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

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
      const { error: err } = await supabase
        .from('plans')
        .update({ is_active: !currentStatus } as any)
        .eq('id', planId);

      if (err) throw err;
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription Plans</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage pricing tiers and features</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update plan details' : 'Add a new subscription plan'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Premium"
                  required
                />
              </div>
              <div>
                <Label htmlFor="price">Monthly Price (KES) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="99"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Plan benefits"
                  required
                />
              </div>
              <div>
                <Label htmlFor="max_vehicles">Max Vehicles *</Label>
                <Input
                  id="max_vehicles"
                  type="number"
                  value={formData.max_vehicles}
                  onChange={(e) => setFormData({ ...formData, max_vehicles: e.target.value })}
                  placeholder="50"
                  required
                />
              </div>
              <div>
                <Label htmlFor="max_drivers">Max Drivers *</Label>
                <Input
                  id="max_drivers"
                  type="number"
                  value={formData.max_drivers}
                  onChange={(e) => setFormData({ ...formData, max_drivers: e.target.value })}
                  placeholder="100"
                  required
                />
              </div>
              <div>
                <Label htmlFor="features">Features (comma-separated) *</Label>
                <textarea
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="Real-time tracking, Analytics, Support"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600 h-20"
                  required
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
          placeholder="Search plans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>Total: {filteredPlans.length} plans</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Price (KES)</TableHead>
                    <TableHead>Max Vehicles</TableHead>
                    <TableHead>Max Drivers</TableHead>
                    <TableHead>Features</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No plans found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.price === 0 ? 'Free' : `KES ${plan.price}`}</TableCell>
                        <TableCell>{plan.max_vehicles}</TableCell>
                        <TableCell>{plan.max_drivers}</TableCell>
                        <TableCell className="text-sm">{(plan.features || []).slice(0, 2).join(', ')}...</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              plan.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'
                            }
                          >
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </Badge>
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
                                onClick={() => handleOpenDialog(plan)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => togglePlanStatus(plan.id, plan.is_active)}
                                className="cursor-pointer"
                              >
                                {plan.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(plan.id)}
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

      {/* Plans Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => (
          <Card key={plan.id} className={plan.is_active ? '' : 'opacity-60'}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold">
                  {plan.price === 0 ? 'Free' : `KES ${plan.price}`}
                </p>
                <p className="text-sm text-gray-500">/month</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Limits:</p>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• {plan.max_vehicles} vehicles</li>
                  <li>• {plan.max_drivers} drivers</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Features:</p>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  {(plan.features || []).map((feature) => (
                    <li key={feature}>✓ {feature}</li>
                  ))}
                </ul>
              </div>
              <Badge
                className={
                  plan.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 w-full justify-center'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300 w-full justify-center'
                }
              >
                {plan.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
