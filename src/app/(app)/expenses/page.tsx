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
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, Trash, Edit } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { NativeSelect } from '@/components/native-select';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useActiveTenant } from '@/hooks/use-active-tenant';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type ExpenseRow = Database['public']['Tables']['expenses']['Row'] & {
  vehicles: { registration_number: string } | null;
};

type VehicleOption = { id: string; registration_number: string };

type ExpenseCategory = NonNullable<Database['public']['Tables']['expenses']['Insert']['category']>;

// Mirrors the check constraint on public.expenses.category.
const EXPENSE_CATEGORIES: ReadonlyArray<{ value: ExpenseCategory; label: string }> = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'license', label: 'License' },
  { value: 'parking', label: 'Parking' },
  { value: 'fine', label: 'Fine' },
  { value: 'other', label: 'Other' },
];

type ExpenseForm = {
  vehicleId: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  description: string;
};

const EMPTY_FORM: ExpenseForm = {
  vehicleId: '',
  category: 'fuel',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
};

export default function ExpensesPage() {
  const { tenantId, userId, loading: tenantLoading, error: tenantError } = useActiveTenant();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    if (!tenantId) return;
    void fetchData(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchData = async (tId: string) => {
    try {
      setLoading(true);
      setLoadError(null);

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

      setExpenses((expensesRes.data as unknown as ExpenseRow[]) || []);
      setVehicles(vehiclesRes.data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (expense?: ExpenseRow) => {
    if (expense) {
      setEditing(expense);
      setForm({
        vehicleId: expense.vehicle_id || '',
        category: expense.category,
        amount: expense.amount.toString(),
        date: expense.date,
        description: expense.description || '',
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      toast({ title: 'No active fleet', description: tenantError || 'Set up your fleet before recording expenses.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    try {
      assertUuid(form.vehicleId, 'Vehicle');
      if (!form.amount || parseFloat(form.amount) <= 0) {
        throw new Error('Enter an amount greater than zero.');
      }

      const payload = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId,
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description.trim() || null,
      };

      if (editing) {
        assertUuid(editing.id, 'Expense');
        await requireRows(
          supabase.from('expenses').update(payload).eq('id', editing.id).select('id'),
          'expense',
          'update',
        );
        toast({ title: 'Expense updated', description: 'The record was saved.' });
      } else {
        await requireRows(
          supabase
            .from('expenses')
            .insert([{ ...payload, recorded_by: userId }])
            .select('id'),
          'expense',
          'create',
        );
        toast({ title: 'Expense recorded', description: 'The new expense is in your log.' });
      }

      setOpen(false);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: editing ? 'Could not update expense' : 'Could not record expense',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return;
    setDeleting(true);
    try {
      assertUuid(deleteTarget.id, 'Expense');
      await requireRows(
        supabase.from('expenses').delete().eq('id', deleteTarget.id).select('id'),
        'expense',
        'delete',
      );
      toast({ title: 'Expense deleted', description: 'The record was removed.' });
      setDeleteTarget(null);
      await fetchData(tenantId);
    } catch (err) {
      toast({
        title: 'Could not delete expense',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fuel':
        return 'bg-orange-100 text-orange-800';
      case 'maintenance':
        return 'bg-blue-100 text-blue-800';
      case 'insurance':
      case 'license':
        return 'bg-teal-100 text-teal-800';
      case 'parking':
        return 'bg-purple-100 text-purple-800';
      case 'fine':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const categoryLabel = (category: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category;

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const pageBlocked = !tenantLoading && !tenantId;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400">Track operational costs</p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {(loadError || tenantError) && (
        <Alert variant="destructive">
          <AlertDescription>{loadError || tenantError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <Card>
        <CardHeader>
          <CardTitle>Expense Log</CardTitle>
          <CardDescription>{expenses.length} expenses recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || tenantLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No expenses recorded yet</p>
              <Button onClick={() => handleOpenDialog()} disabled={pageBlocked} className="mt-4">
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
                      <TableCell className="font-medium">{expense.vehicles?.registration_number || '—'}</TableCell>
                      <TableCell>
                        <div className={`inline-block rounded px-2 py-1 text-sm font-medium ${getCategoryColor(expense.category)}`}>
                          {categoryLabel(expense.category)}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">KES {Number(expense.amount).toLocaleString()}</TableCell>
                      <TableCell>{expense.description || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" aria-label="Edit expense" onClick={() => handleOpenDialog(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" aria-label="Delete expense" onClick={() => setDeleteTarget(expense)}>
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

      <SafeDialog open={open} onOpenChange={setOpen}>
        <SafeDialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Vehicle *</Label>
              <NativeSelect value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} required>
                <option value="" disabled>Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration_number}</option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label>Type *</Label>
              <NativeSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label>Amount (KES) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
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
                placeholder="Optional notes…"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 bg-blue-600">
                {submitting ? 'Saving…' : editing ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete expense?"
        description="This expense record will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
