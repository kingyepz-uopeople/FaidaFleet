'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Trash2, Edit, Receipt, TrendingDown } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow, requireUuid } from '@/lib/db';
import { withRecordedBy } from '@/lib/record-payload';
import { toastError, toastSuccess } from '@/lib/toast';
import { formatDateOnly } from '@/lib/dates';
import { EmptyState, LoadFailure, PageShell, TableScroll } from '@/components/page-shell';
import { StatCard } from '@/components/stat-card';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { DriverScopeNotice } from '@/components/driver-scope';
import { compressPumpPhoto, fuelPumpPhotoPath } from '@/lib/fuel-photo';
import { fuelPriceFromTotal, fuelTotalFromPrice } from '@/lib/fuel';
import { appendUniqueExpenses, expenseCursorFilter, splitExpensePage, type ExpenseCursor } from '@/lib/expense-pagination';
import { CATEGORY_LABELS, EMPTY_FORM, type Expense, type FuelLogEntry, type Option } from './expense-types';

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
const PHOTO_BUCKET = 'fuel-pump-photos';
const EXPENSE_PAGE_SIZE = 100;
const EXPENSE_FIELDS = 'id, created_at, vehicle_id, category, amount, date, description, recorded_by, odometer_km, litres, price_per_litre, pump_photo_path, pump_photo_expires_at, pump_photo_deleted_at, vehicles(registration_number)';

const ExpenseFormDialog = dynamic(() => import('./expense-form-dialog'), {
  ssr: false,
  loading: () => <span role="status" className="sr-only">Opening expense form…</span>,
});
const ExpenseDetailDialog = dynamic(() => import('./expense-detail-dialog'), {
  ssr: false,
  loading: () => <span role="status" className="sr-only">Opening fuel details…</span>,
});


function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ExpensesView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ownFuelEntries, setOwnFuelEntries] = useState<FuelLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadGeneration = useRef(0);
  const nextExpenseCursor = useRef<ExpenseCursor | null>(null);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedScopeKey, setLoadedScopeKey] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pumpPhoto, setPumpPhoto] = useState<Blob | null>(null);
  const [pumpPhotoPreview, setPumpPhotoPreview] = useState<string | null>(null);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    userId,
    tenantId,
    role,
    isDriver,
    vehicleId,
    vehicleLabel,
    loadError: accessError,
  } = useFleetAccess();
  const scopeKey = `${tenantId || ''}:${isDriver}:${vehicleId || ''}:${userId || ''}`;
  const canRecord = !isDriver || Boolean(vehicleId);
  const canViewPumpPhotos = role === 'owner' || role === 'admin';
  const searchParams = useSearchParams();
  const quickFuel = searchParams.get('new') === 'fuel';

  useEffect(() => {
    if (!accessLoading) void fetchData();
    return () => { loadGeneration.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, tenantId, isDriver, vehicleId, userId]);

  useEffect(() => {
    // A dialog opened in an earlier fleet/user scope must not survive a switch.
    setDialogOpen(false);
    setDetailExpense(null);
    setEditing(null);
  }, [scopeKey]);

  // Quick "Log fuel" entry from the driver menu: /expenses?new=fuel
  useEffect(() => {
    if (accessLoading || !canRecord || !quickFuel) return;
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      vehicleId: isDriver ? vehicleId || '' : '',
      category: 'fuel',
    });
    setPumpPhoto(null);
    setPumpPhotoPreview(null);
    setFormError(null);
    setDialogOpen(true);
  }, [accessLoading, canRecord, isDriver, vehicleId, quickFuel]);

  useEffect(() => {
    return () => {
      if (pumpPhotoPreview) URL.revokeObjectURL(pumpPhotoPreview);
    };
  }, [pumpPhotoPreview]);

  const fetchExpensePage = async (cursor: ExpenseCursor | null) => {
    if (!tenantId) throw new Error('No fleet found for this account.');
    let query = supabase.from('expenses').select(EXPENSE_FIELDS, { count: 'exact' }).eq('tenant_id', tenantId);
    if (isDriver) query = query.eq('vehicle_id', vehicleId || NO_MATCH_UUID);
    if (cursor) query = query.or(expenseCursorFilter(cursor));
    // Fetch one extra row to tell the user whether more are available. The id
    // is a tie-breaker for stable pages when timestamps and dates are equal.
    const result = await query.order('created_at', { ascending: false, nullsFirst: true })
      .order('date', { ascending: false }).order('id', { ascending: false })
      .limit(EXPENSE_PAGE_SIZE + 1);
    if (result.error) throw new Error(result.error.message);
    const rows = (result.data || []) as Expense[];
    if (result.count === null || (result.count > 0 && rows.length === 0)) {
      throw new Error('Could not determine whether more expenses are available. Please try again.');
    }
    return splitExpensePage(rows, EXPENSE_PAGE_SIZE, result.count);
  };

  const fetchData = async () => {
    const generation = ++loadGeneration.current;
    try {
      setLoading(true);
      setLoadingMore(false);
      setLoadError(null);
      if (!tenantId) throw new Error(accessError || 'No fleet is linked to this account yet. Finish onboarding to record expenses.');

      const [page, vehiclesRes, fuelRes] = await Promise.all([
        fetchExpensePage(null),
        isDriver
          ? supabase.from('vehicles').select('id, registration_number').eq('id', vehicleId || NO_MATCH_UUID).limit(1)
          : supabase.from('vehicles').select('id, registration_number').eq('tenant_id', tenantId).eq('is_active', true).order('registration_number'),
        // The driver's five latest fuel entries must remain correct even when
        // they fall outside the first page of the general expense log.
        isDriver && userId
          ? supabase.from('expenses').select('id, date, amount, litres, odometer_km, price_per_litre')
              .eq('tenant_id', tenantId).eq('vehicle_id', vehicleId || NO_MATCH_UUID)
              .eq('recorded_by', userId).eq('category', 'fuel')
              .order('created_at', { ascending: false }).order('date', { ascending: false })
              .order('id', { ascending: false }).limit(5)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
      if (fuelRes.error) throw new Error(fuelRes.error.message);
      if (generation !== loadGeneration.current) return;
      setExpenses(page.rows);
      nextExpenseCursor.current = page.rows.at(-1) || null;
      setHasMore(page.hasMore);
      setOwnFuelEntries((fuelRes.data || []) as FuelLogEntry[]);
      setVehicles((vehiclesRes.data || []).map((row) => ({ id: row.id, label: row.registration_number })));
      setLoadedScopeKey(scopeKey);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      // Never show a previous fleet's totals or fuel log as the current data
      // after an access change or a failed refresh.
      setExpenses([]);
      setOwnFuelEntries([]);
      setVehicles([]);
      nextExpenseCursor.current = null;
      setHasMore(false);
      setLoadedScopeKey(scopeKey);
      const message = err instanceof Error ? err.message : 'Could not load expenses';
      setLoadError(message);
      toastError(message, 'Could not load expenses');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !nextExpenseCursor.current) return;
    const generation = loadGeneration.current;
    setLoadingMore(true);
    try {
      const page = await fetchExpensePage(nextExpenseCursor.current);
      if (generation !== loadGeneration.current) return;
      nextExpenseCursor.current = page.rows.at(-1) || nextExpenseCursor.current;
      setExpenses((current) => appendUniqueExpenses(current, page.rows));
      setHasMore(page.hasMore);
    } catch (error) {
      if (generation === loadGeneration.current) toastError(error, 'Could not load more expenses');
    } finally {
      if (generation === loadGeneration.current) setLoadingMore(false);
    }
  };

  const clearPhoto = () => {
    setPumpPhoto(null);
    setPumpPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const openCreate = () => {
    if (!canRecord) return;
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      vehicleId: isDriver ? vehicleId || '' : '',
    });
    clearPhoto();
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
      litres: expense.litres?.toString() || '',
      pricePerLitre: expense.price_per_litre?.toString() || '',
      odometerKm: expense.odometer_km?.toString() || '',
      date: expense.date,
      description: expense.description || '',
    });
    clearPhoto();
    setFormError(null);
    setDialogOpen(true);
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoPreparing(true);
    setFormError(null);
    try {
      const compressed = await compressPumpPhoto(file);
      setPumpPhoto(compressed);
      setPumpPhotoPreview(URL.createObjectURL(compressed));
    } catch (error) {
      clearPhoto();
      setFormError(error instanceof Error ? error.message : 'Could not prepare the photo');
    } finally {
      setPhotoPreparing(false);
      event.target.value = '';
    }
  };

  const updateFuelNumber = (field: 'litres' | 'pricePerLitre' | 'amount', value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (current.category !== 'fuel') return next;

      const litres = Number.parseFloat(next.litres);
      if (field === 'amount') {
        const price = fuelPriceFromTotal(litres, Number.parseFloat(value));
        if (price !== null) next.pricePerLitre = String(price);
      } else if (field === 'litres' && !next.pricePerLitre && next.amount) {
        const price = fuelPriceFromTotal(litres, Number.parseFloat(next.amount));
        if (price !== null) next.pricePerLitre = String(price);
      } else {
        const total = fuelTotalFromPrice(litres, Number.parseFloat(next.pricePerLitre));
        if (total !== null) next.amount = String(total);
      }
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (!tenantId) throw new Error('No fleet found for this account.');
      if (isDriver && editing) throw new Error('Drivers cannot edit recorded expenses.');
      if (!canRecord) throw new Error('Ask your fleet owner to assign you a current vehicle first.');
      if (photoPreparing) throw new Error('Wait for the pump photo to finish preparing.');

      const isFuel = form.category === 'fuel';
      const selectedVehicleId = isDriver
        ? requireUuid(vehicleId, 'vehicle')
        : isFuel
          ? requireUuid(form.vehicleId, 'vehicle')
          : form.vehicleId || null;
      const amount = Number.parseFloat(form.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid amount');
      if (!form.date) throw new Error('Choose the expense date');

      const odometerKm = isFuel ? optionalNumber(form.odometerKm) : null;
      const litres = isFuel ? optionalNumber(form.litres) : null;
      const pricePerLitre = isFuel ? optionalNumber(form.pricePerLitre) : null;
      const newFuelRecord = isFuel && (!editing || editing.category !== 'fuel');
      if (newFuelRecord && odometerKm === null) throw new Error('Odometer km is required for fuel');
      if (newFuelRecord && (litres === null || litres <= 0)) throw new Error('Enter litres greater than zero');
      if (newFuelRecord && (pricePerLitre === null || pricePerLitre <= 0)) throw new Error('Enter a price per litre greater than zero');
      if (newFuelRecord && amount <= 0) throw new Error('Enter a fuel total greater than zero');
      if (odometerKm !== null && odometerKm < 0) throw new Error('Odometer km cannot be negative');
      if (litres !== null && litres < 0) throw new Error('Litres cannot be negative');
      if (pricePerLitre !== null && pricePerLitre < 0) throw new Error('Price per litre cannot be negative');
      if (isDriver && isFuel && !pumpPhoto) throw new Error('Take a photo of the pump before saving fuel');

      let pumpPhotoPath: string | null = null;
      if (isFuel && pumpPhoto && selectedVehicleId) {
        pumpPhotoPath = fuelPumpPhotoPath(tenantId, selectedVehicleId);
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(pumpPhotoPath, pumpPhoto, {
            contentType: 'image/jpeg',
            upsert: false,
          });
        if (uploadError) throw new Error(`Could not upload the pump photo: ${uploadError.message}`);
      }

      const payload = {
        tenant_id: tenantId,
        vehicle_id: selectedVehicleId,
        category: form.category,
        amount,
        date: form.date,
        description: form.description.trim() || null,
        odometer_km: odometerKm,
        litres,
        price_per_litre: pricePerLitre,
        ...(editing ? {} : { pump_photo_path: pumpPhotoPath }),
      };

      // pump_photo_expires_at is set by the database from the tenant's
      // retention setting, so clients cannot extend their own photo retention.
      const result = editing
        ? await supabase.from('expenses').update(payload).eq('id', editing.id).select('id')
        : await supabase.from('expenses').insert([withRecordedBy(payload, userId)]).select('id');

      assertMutationRow(result, editing ? 'Could not update the expense' : 'Could not record the expense');
      toastSuccess(editing ? 'Expense updated.' : 'Expense recorded.', 'Saved');
      setDialogOpen(false);
      clearPhoto();
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
  const isLoading = loading || accessLoading || loadedScopeKey !== scopeKey;
  const formDisabled = submitting || photoPreparing;

  return (
    <PageShell
      loading={isLoading}
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
          loading={isLoading}
          title="Total expenses"
          value={loadError ? '—' : `KES ${totalExpenses.toLocaleString()}`}
          description={loadError ? 'Totals unavailable' : `${expenses.length} loaded records`}
          Icon={TrendingDown}
        />
        <StatCard loading={isLoading} title="Average expense" value={loadError ? '—' : `KES ${averageExpense.toLocaleString()}`} description={loadError ? 'Totals unavailable' : 'Per loaded transaction'} Icon={Receipt} />
      </div>

      {isDriver && (
        <Card>
          <CardHeader>
            <CardTitle>My fuel log</CardTitle>
            <CardDescription>Your five most recent fuel entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3" role="status" aria-label="Loading your fuel log">
                {[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}
              </div>
            ) : loadError ? (
              <p className="py-4 text-sm text-muted-foreground">Your fuel log could not be loaded.</p>
            ) : ownFuelEntries.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Fuel you enter will appear here.</p>
            ) : (
              <ul className="divide-y">
                {ownFuelEntries.map((expense) => (
                  <li key={expense.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{formatDateOnly(expense.date)}</p>
                      <p className="font-semibold">KES {expense.amount.toLocaleString()}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {expense.litres ?? '—'} L · {expense.odometer_km ?? '—'} km
                      {expense.price_per_litre !== null ? ` · KES ${expense.price_per_litre}/L` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense log</CardTitle>
          <CardDescription>
            {isLoading ? <Skeleton className="h-4 w-32" /> : loadError ? 'Expenses could not be loaded.' : `Showing the latest ${expenses.length} expenses${hasMore ? ' · more available' : ''}. Totals above reflect the expenses shown.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading expenses">
              <span className="sr-only">Loading expenses…</span>
              {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}
            </div>
          ) : loadError ? (
            <LoadFailure label="expenses" message={loadError} onRetry={fetchData} />
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
                    {(canViewPumpPhotos && expense.category === 'fuel') || !isDriver ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canViewPumpPhotos && expense.category === 'fuel' && (
                          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setDetailExpense(expense)}>
                            <Receipt className="mr-2 h-4 w-4" /> Details
                          </Button>
                        )}
                        {!isDriver && (
                          <>
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
                          </>
                        )}
                      </div>
                    ) : null}
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
                              {canViewPumpPhotos && expense.category === 'fuel' && (
                                <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setDetailExpense(expense)}>
                                  <Receipt className="h-4 w-4" />
                                  <span className="sr-only">View fuel record details</span>
                                </Button>
                              )}
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
              {hasMore && (
                <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more expenses'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <ExpenseFormDialog
          editing={editing} form={form} setForm={setForm} setDialogOpen={setDialogOpen}
          isDriver={isDriver} vehicleLabel={vehicleLabel} vehicles={vehicles}
          formDisabled={formDisabled} submitting={submitting} photoPreparing={photoPreparing}
          photoInputRef={photoInputRef} pumpPhoto={pumpPhoto} pumpPhotoPreview={pumpPhotoPreview}
          formError={formError} handleSubmit={handleSubmit} handlePhotoSelected={handlePhotoSelected}
          updateFuelNumber={updateFuelNumber}
        />
      )}

      {detailExpense && (
        <ExpenseDetailDialog detailExpense={detailExpense} canViewPumpPhotos={canViewPumpPhotos} onClose={() => setDetailExpense(null)} />
      )}
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
