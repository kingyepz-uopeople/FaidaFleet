'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { EmptyState, PageShell, TableScroll } from '@/components/page-shell';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { StatCard } from '@/components/stat-card';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { DriverScopeNotice, LockedValue } from '@/components/driver-scope';

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';

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

function ExpensesView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    tenantId,
    isDriver,
    vehicleId,
    vehicleLabel,
    loadError: accessError,
  } = useFleetAccess();
  const canRecord = !isDriver || Boolean(vehicleId);
  const searchParams = useSearchParams();
  const quickFuel = searchParams.get('new') === 'fuel';

  useEffect(() => {
    if (!accessLoading) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, tenantId, isDriver, vehicleId]);

  // Quick "Log fuel" entry from the driver menu: /expenses?new=fuel
  useEffect(() => {
    if (accessLoading || !canRecord || !quickFuel) return;
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      vehicleId: isDriver ? vehicleId || '' : '',
      category: 'fuel',
    });
    setFormError(null);
    setDialogOpen(true);
  }, [accessLoading, canRecord, isDriver, vehicleId, quickFuel]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      if (!tenantId) {
        setLoadError(accessError || 'No fleet is linked to this account yet. Finish onboarding to record expenses.');
        return;
      }

      const [expensesRes, vehiclesRes] = await Promise.all([
        (isDriver
          ? supabase
              .from('expenses')
              .select('*, vehicles(registration_number)')
              .eq('tenant_id', tenantId)
              .eq('vehicle_id', vehicleId || NO_MATCH_UUID)
          : supabase
              .from('expenses')
              .select('*, vehicles(registration_number)')
              .eq('tenant_id', tenantId)
        ).order('date', { ascending: false }),
        isDriver
          ? supabase.from('vehicles').select('id, registration_number').eq('id', vehicleId || NO_MATCH_UUID).limit(1)
          : supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tenantId).eq('is_active', true).order('registration_number'),
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
    if (!canRecord) return;
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      vehicleId: isDriver ? vehicleId || '' : '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    if (isDriver) return;
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
      if (isDriver && editing) throw new Error('Drivers cannot edit recorded expenses.');
      if (!canRecord) throw new Error('Ask your fleet owner to assign you a current vehicle first.');
      const selectedVehicleId = isDriver ? requireUuid(vehicleId, 'vehicle') : form.vehicleId || null;
      const amount = Number.parseFloat(form.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid amount');
      if (!form.date) throw new Error('Choose the expense date');

      const payload = {
        tenant_id: tenantId,
        vehicle_id: selectedVehicleId,
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
    if (isDriver) return;
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
      title={isDriver ? 'My expenses & fuel' : 'Expenses'}
      description={isDriver ? 'Log fuel and other costs for your assigned vehicle.' : 'Track fuel, maintenance, and other operating costs.'}
      actions={
        <Button type="button" className="min-h-11" onClick={openCreate} disabled={!canRecord}>
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
      {isDriver && accessError && <DriverScopeNotice message={accessError} />}

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
          {loading || accessLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              title="No expenses recorded yet"
              description="Add an expense to keep your profit figures accurate."
              action={canRecord ? (
                <Button type="button" onClick={openCreate}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Record your first expense
                </Button>
              ) : undefined}
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
                    {!isDriver && (
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
                    )}
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
                      {!isDriver && <TableHead className="text-right">Actions</TableHead>}
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
                        {!isDriver && (
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
                        )}
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
        description={isDriver ? `Log ${form.category === 'fuel' ? 'fuel' : 'an expense'} for your assigned vehicle.` : 'Vehicle is optional for costs that are not tied to one vehicle.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {isDriver ? (
            <LockedValue id="expense_vehicle_locked" label="Vehicle" value={vehicleLabel || 'No vehicle assigned'} hint="Fuel is always logged against your current vehicle." />
          ) : (
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
          )}

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

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading expenses…</div>}>
      <ExpensesView />
    </Suspense>
  );
}
