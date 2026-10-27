'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Download } from '@/components/icons';
import { AdminFeedback, AdminKpi, AdminPageHeader, AdminRecordList, AdminSearch, StatusBadge, formatKes, titleCase } from '@/components/admin-ui';
import { formatDateOnly } from '@/lib/dates';
import { toastError } from '@/lib/toast';
import { isAdminUiPreview, previewCollections } from '@/lib/admin-preview';

type Collection = {
  id: string;
  amount: number;
  date: string;
  payment_method: string;
  reconciled: boolean;
  drivers: { full_name: string };
  tenants: { name: string };
};

function methodTone(method: string) {
  if (method === 'mpesa') return 'success' as const
  if (method === 'cash') return 'info' as const
  if (method === 'pochi') return 'plan' as const
  return 'neutral' as const
}

export default function CollectionsPage() {
  const preview = isAdminUiPreview();
  const [collections, setCollections] = useState<Collection[]>(preview ? previewCollections : []);
  const [loading, setLoading] = useState(!preview);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'amount'>('date');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setCollections(previewCollections);
        return;
      }
      setError(null);
      const { data, error: loadError } = await supabase
        .from('collections')
        .select('*, drivers(full_name), tenants(name)')
        .order('date', { ascending: false })
        .limit(1000);

      if (loadError) throw loadError;
      setCollections((data || []) as Collection[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load collections';
      setError(message);
      toastError(message, 'Could not load collections');
    } finally {
      setLoading(false);
    }
  };

  const filteredCollections = useMemo(() => {
    let filtered = collections;
    if (searchQuery) {
      const needle = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.drivers?.full_name?.toLowerCase().includes(needle) ||
          c.tenants?.name?.toLowerCase().includes(needle),
      );
    }
    if (startDate) filtered = filtered.filter((c) => new Date(c.date) >= new Date(startDate));
    if (endDate) filtered = filtered.filter((c) => new Date(c.date) <= new Date(endDate));
    return [...filtered].sort((a, b) => {
      if (sortKey === 'amount') return b.amount - a.amount;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [collections, searchQuery, startDate, endDate, sortKey]);

  const totalAmount = filteredCollections.reduce((sum, c) => sum + c.amount, 0);
  const paymentMethodStats = collections.reduce<Record<string, number>>((stats, c) => {
    stats[c.payment_method] = (stats[c.payment_method] || 0) + c.amount;
    return stats;
  }, {});
  const exportCsv = () => {
    const header = ['Date', 'Driver', 'Fleet', 'Amount (KES)', 'Method', 'Status'];
    const rows = filteredCollections.map((collection) => [
      collection.date,
      collection.drivers?.full_name || '',
      collection.tenants?.name || '',
      collection.amount,
      collection.payment_method,
      collection.reconciled ? 'Reconciled' : 'Pending',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `faidafleet-collections-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reconcileStats = {
    reconciled: filteredCollections.filter((c) => c.reconciled).length,
    pending: filteredCollections.filter((c) => !c.reconciled).length,
  };

  return (
    <>
      <AdminPageHeader
        title="Collections"
        description="System-wide collection tracking and reconciliation."
        actions={
          <Button type="button" variant="outline" onClick={exportCsv} disabled={filteredCollections.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <AdminFeedback error={error} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpi title="Total" value={formatKes(totalAmount)} hint={`${filteredCollections.length} records`} />
        <AdminKpi title="Reconciled" value={String(reconcileStats.reconciled)} hint={filteredCollections.length ? `${Math.round((reconcileStats.reconciled / filteredCollections.length) * 100)}%` : '0%'} />
        <AdminKpi title="Pending" value={String(reconcileStats.pending)} hint="Awaiting reconciliation" />
        <AdminKpi title="Average" value={formatKes(filteredCollections.length ? totalAmount / filteredCollections.length : 0)} hint="Per transaction" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search driver or fleet…" />
        <div>
          <Label htmlFor="start">From</Label>
          <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="end">To</Label>
          <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sort">Sort</Label>
          <select id="sort" className="flex h-11 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as 'date' | 'amount')}>
            <option value="date">Newest date</option>
            <option value="amount">Highest amount</option>
          </select>
        </div>
      </div>

      {Object.keys(paymentMethodStats).length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(paymentMethodStats).map(([method, amount]) => (
            <Card key={method}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{method}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{formatKes(amount)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AdminRecordList
        rows={filteredCollections}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No collections found"
        emptyDescription="Try a different date range or search."
        columns={[
          { id: 'driver', header: 'Driver', cell: (row) => <span className="font-medium">{row.drivers?.full_name || '—'}</span> },
          { id: 'fleet', header: 'Fleet', cell: (row) => row.tenants?.name || '—' },
          { id: 'amount', header: 'Amount', cell: (row) => formatKes(row.amount) },
          { id: 'method', header: 'Method', cell: (row) => <StatusBadge tone={methodTone(row.payment_method)}>{titleCase(row.payment_method)}</StatusBadge> },
          { id: 'date', header: 'Date', cell: (row) => formatDateOnly(row.date), hideOnMobile: true },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.reconciled ? 'success' : 'warning'}>{row.reconciled ? 'Reconciled' : 'Pending'}</StatusBadge> },
        ]}
      />
    </>
  );
}
