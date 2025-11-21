"use client";

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, Trash, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Expense = {
  id: string;
  vehicle_id: string;
  category: string;
  amount: number;
  date: string;
  description: string | null;
  vehicles: { registration_number: string };
};

type Vehicle = {
  id: string;
  registration_number: string;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [form, setForm] = useState({
    vehicleId: '',
    category: 'Fuel',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const membershipResp = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const membership: any = membershipResp.data;
      if (!membership) throw new Error('No tenant found');
      const tId = membership.tenant_id;
      setTenantId(tId);

      const [expensesRes, vehiclesRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, vehicles(registration_number)')
          .eq('tenant_id', tId)
          .order('date', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', tId)
          .eq('is_active', true)
          .order('registration_number'),
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setExpenses(expensesRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditing(expense);
      setForm({
        vehicleId: expense.vehicle_id,
        category: expense.category.charAt(0).toUpperCase() + expense.category.slice(1),
        amount: expense.amount.toString(),
        date: expense.date,
        description: expense.description || '',
      });
    } else {
      setEditing(null);
      setForm({
        vehicleId: '',
        category: 'Fuel',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!tenantId) throw new Error('No tenant found');
      if (!form.vehicleId || !form.amount) {
        throw new Error('Vehicle and Amount are required');
      }

      const payload: any = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId,
        category: form.category.toLowerCase(),
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description || null,
      };

      if (editing) {
        const { error: err } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editing.id);
        if (err) throw err;
        setSuccess('Expense updated successfully');
      } else {
        const { error: err } = await supabase
          .from('expenses')
          .insert([payload]);
        if (err) throw err;
        setSuccess('Expense recorded successfully');
      }

      setOpen(false);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;

    try {
      const { error: err } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setSuccess('Expense deleted successfully');
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'fuel':
        return 'bg-orange-100 text-orange-800';
      case 'maintenance':
        return 'bg-blue-100 text-blue-800';
      case 'fine':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400">Track operational costs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Vehicle *</Label>
                <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registration_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fuel">Fuel</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Fine">Fine</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount (KES) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full border rounded px-2 py-2"
                  rows={3}
                />
              </div>

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-blue-600">
                  {submitting ? 'Saving...' : editing ? 'Update' : 'Add'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 text-green-800 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{expenses.length} records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {expenses.length > 0 ? Math.round(totalExpenses / expenses.length) : 0}</p>
            <p className="text-sm text-gray-500">Per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Log</CardTitle>
          <CardDescription>{expenses.length} expenses recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No expenses recorded yet</p>
              <Button onClick={() => handleOpenDialog()} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Record First Expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-medium">{expense.vehicles?.registration_number}</TableCell>
                      <TableCell>
                        <div className={`inline-block px-2 py-1 rounded text-sm font-medium ${getCategoryColor(expense.category)}`}>
                          {expense.category}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">KES {expense.amount.toLocaleString()}</TableCell>
                      <TableCell>{expense.description || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)}>
                            <Trash className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
