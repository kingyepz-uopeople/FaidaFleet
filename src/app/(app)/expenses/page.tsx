'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusCircle, Loader2, Trash2, Edit, Receipt, TrendingDown } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { EmptyState, PageShell, TableScroll } from '@/components/page-shell';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { StatCard } from '@/components/stat-card';

type ExpenseCategory = 'fuel' | 'maintenance' | 'insurance' | 'license' | 'parking' | 'fine' | 'other';

type Expense = {
  id: string;
  vehicle_id: string | null;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string | null;
  vehicles: { registration_number: string } | null;
};

type Option = { id: string; label: string };

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  insurance: 'Insurance',
  license: 'Licence',
  parking: 'Parking',
  fine: 'Fine',
  other: 'Other',
};

const EMPTY_FORM = {
  vehicleId: '',
  category: 'fuel' as ExpenseCategory,
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to sign in again.');

      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        setLoadError('No fleet is linked to this account yet. Finish onboarding to record expenses.');
        return;
      }

      setTenantId(membership.tenant_id);

      const [expensesRes, vehiclesRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, vehicles(registration_number)')
          .eq('tenant_id', membership.tenant_id)
          .order('date', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number')
          .eq('tenant_id', membership.tenant_id)
          .eq('is_active', true)
          .order('registration_number'),
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setExpenses((expensesRes.data || []) as Expense[]);
      setVehicles((vehiclesRes.data || []).map((row) => ({ id: row.id, label: row.registration_number })));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load expenses';
      setLoadError(message);
      toastError(message, 'Could not load expenses');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      vehicleId: expense.vehicle_id || '',
      category: expense.category,
      amount: expense.amount.toString(),
      date: expense.date,
      description: expense.description || '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (!tenantId) throw new Error('No fleet found for this account.');
      const amount = Number.parseFloat(form.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid amount');
      if (!form.date) throw new Error('Choose the expense date');

      const payload = {
        tenant_id: tenantId,
        vehicle_id: form.vehicleId || null,
        category: form.category,
        amount,
        date: form.date,
        description: form.description.trim() || null,
      };

      const result = editing
        ? await supabase.from('expenses').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('expenses').insert([payload]).select('id');

      assertMutationRow(result, editing ? 'Could not update the expense' : 'Could not record the expense');
      toastSuccess(editing ? 'Expense updated.' : 'Expense recorded.', 'Saved');
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the expense';
      setFormError(message);
      toastError(message, 'Could not save the expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    try {
      const result = await supabase.from('expenses').delete().eq('id', expense.id).select('id');
      assertMutation(result, 'Could not delete the expense');
      toastSuccess('Expense deleted.', 'Deleted');
      await fetchData();
    } catch (err) {
      toastError(err, 'Could not delete the expense');
    }
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const averageExpense = expenses.length > 0 ? Math.round(totalExpenses / expenses.length) : 0;

  return (
    <PageShell
      title="Expenses"
      description="Track fuel, maintenance, and other operating costs."
      actions={
        <Button type="button" onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add expense
        </Button>
      }
    >
      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          title="Total expenses"
          value={`KES ${totalExpenses.toLocaleString()}`}
          description={`${expenses.length} records`}
          Icon={TrendingDown}
        />
        <StatCard title="Average expense" value={`KES ${averageExpense.toLocaleString()}`} description="Per transaction" Icon={Receipt} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense log</CardTitle>
          <CardDescription>{expenses.length} expenses recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              title="No expenses recorded yet"
              description="Add an expense to keep your profit figures accurate."
              action={
                <Button type="button" onClick={openCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Record your first expense
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {expenses.map((expense) => (
                  <article key={expense.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">KES {expense.amount.toLocaleString()}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {expense.vehicles?.registration_number || 'General expense'} · {formatDateOnly(expense.date)}
                        </p>
                      </div>
                      <Badge variant="secondary">{CATEGORY_LABELS[expense.category]}</Badge>
                    </div>
                    {expense.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{expense.description}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => openEdit(expense)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 text-destructive"
                        onClick={() => handleDelete(expense)}
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <TableScroll>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDateOnly(expense.date)}</TableCell>
                        <TableCell className="font-medium">{expense.vehicles?.registration_number || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{CATEGORY_LABELS[expense.category]}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">KES {expense.amount.toLocaleString()}</TableCell>
                        <TableCell className="max-w-xs truncate">{expense.description || '—'}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => openEdit(expense)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit expense</span>
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="min-h-11 text-destructive" onClick={() => handleDelete(expense)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete expense</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableScroll>
            </>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit expense' : 'Add expense'}
        description="Vehicle is optional for costs that are not tied to one vehicle."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense_vehicle">Vehicle</Label>
            <NativeSelect
              id="expense_vehicle"
              value={form.vehicleId}
              onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}
              disabled={submitting}
            >
              <option value="">General expense</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense_category">Type *</Label>
            <NativeSelect
              id="expense_category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseCategory })}
              required
              disabled={submitting}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense_amount">Amount (KES) *</Label>
              <Input
                id="expense_amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="0.00"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense_date">Date *</Label>
              <Input
                id="expense_date"
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense_description">Description</Label>
            <textarea
              id="expense_description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Optional notes…"
              rows={3}
              disabled={submitting}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
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
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                'Update expense'
              ) : (
                'Add expense'
              )}
            </Button>
          </div>
        </form>
      </FormDialog>
    </PageShell>
  );
}
