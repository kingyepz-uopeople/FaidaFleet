'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { driverLeaderboard, type DriverCollection, type DriverInput, type DriverTrip, type DriverStats } from '@/lib/fleet-metrics';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { formatDateOnly } from '@/lib/dates';
import { fetchReportPages, trailingDateRange, validReportRange } from '@/lib/report-range';

function SummarySkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4" role="status" aria-label="Loading driver totals">
      <span className="sr-only">Loading driver totals…</span>
      {[0, 1, 2, 3].map((item) => (
        <Card key={item}>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-9 w-36" /></CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DriverAnalyticsPage() {
  const [drivers, setDrivers] = useState<DriverStats[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [rangeKeyLoaded, setRangeKeyLoaded] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState('365');
  const [reportToday, setReportToday] = useState<Date | null>(null);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    tenantId,
    loadError: accessError,
  } = useFleetAccess();
  const range = reportToday
    ? rangeDays === 'custom' ? customRange : trailingDateRange(Number.parseInt(rangeDays, 10), reportToday)
    : { start: '', end: '' };
  const reportReady = Boolean(reportToday);
  const validRange = reportReady && validReportRange(range);
  const rangeKey = `${tenantId || ''}:${range.start}:${range.end}`;
  const loading = dataLoading || accessLoading || (validRange && rangeKeyLoaded !== rangeKey);

  // Resolve the browser's calendar day after hydration (the server may be in a
  // different timezone). Custom dates can reach older or future records.
  useEffect(() => {
    const today = new Date();
    setReportToday(today);
    setCustomRange(trailingDateRange(365, today));
  }, []);

  useEffect(() => {
    if (accessLoading || !reportReady) return;
    if (!validRange) {
      setDrivers([]);
      setRangeKeyLoaded('');
      setError('Choose valid start and end dates in chronological order.');
      setDataLoading(false);
      return;
    }
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setDataLoading(true);
        setError(null);
        if (!tenantId) throw new Error(accessError || 'No tenant found');

        // Separate ordered pages avoid PostgREST's response cap silently
        // truncating the totals, while all three queries start in parallel.
        const [driverRows, collections, trips] = await Promise.all([
          fetchReportPages((from, to) => supabase.from('drivers').select('id, full_name', { count: from === 0 ? 'exact' : undefined })
            .eq('tenant_id', tenantId).eq('is_active', true).order('id')
            .range(from, to).abortSignal(controller.signal)),
          fetchReportPages((from, to) => supabase.from('collections').select('id, driver_id, amount', { count: from === 0 ? 'exact' : undefined })
            .eq('tenant_id', tenantId).gte('date', range.start).lte('date', range.end)
            .order('date').order('id').range(from, to).abortSignal(controller.signal)),
          fetchReportPages((from, to) => supabase.from('trips').select('id, driver_id, expenses', { count: from === 0 ? 'exact' : undefined })
            .eq('tenant_id', tenantId).gte('trip_date', range.start).lte('trip_date', range.end)
            .order('trip_date').order('id').range(from, to).abortSignal(controller.signal)),
        ]);

        if (!controller.signal.aborted) {
          setDrivers(driverLeaderboard(
            driverRows as DriverInput[],
            collections as DriverCollection[],
            trips as DriverTrip[],
          ));
          setRangeKeyLoaded(rangeKey);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setDrivers([]);
        setRangeKeyLoaded(rangeKey);
        setError(err instanceof Error ? err.message : 'Could not load the report');
      } finally {
        if (!controller.signal.aborted) setDataLoading(false);
      }
    };
    void fetchData();
    return () => controller.abort();
  }, [accessLoading, accessError, tenantId, reportReady, validRange, range.start, range.end, rangeKey, supabase]);

  const totalCollections = drivers.reduce((sum, driver) => sum + driver.collections, 0);
  const totalExpenses = drivers.reduce((sum, driver) => sum + driver.expenses, 0);
  const totalProfit = drivers.reduce((sum, driver) => sum + driver.profit, 0);
  const avgProfit = drivers.length > 0 ? Math.round(totalProfit / drivers.length) : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-3xl font-bold">Driver Performance</h1>
        <p className="text-gray-600 dark:text-gray-400">Collections minus the costs recorded on each driver&apos;s trips</p>
        <label htmlFor="driver_range" className="mt-3 block text-sm text-muted-foreground">Reporting range</label>
        <NativeSelect id="driver_range" className="mt-2 min-h-11 sm:w-56" value={rangeDays} onChange={(event) => { setReportToday(new Date()); setRangeDays(event.target.value); }} disabled={loading}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 365 days</option>
          <option value="730">Last 730 days</option>
          <option value="1825">Last 1,825 days</option>
          <option value="custom">Custom dates</option>
        </NativeSelect>
        {rangeDays === 'custom' && (
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <div><label htmlFor="driver_start" className="text-sm text-muted-foreground">From</label><Input id="driver_start" type="date" value={customRange.start} onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))} /></div>
            <div><label htmlFor="driver_end" className="text-sm text-muted-foreground">Through</label><Input id="driver_end" type="date" value={customRange.end} onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))} /></div>
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{!reportToday ? 'Loading reporting range…' : validRange ? `All totals and the leaderboard cover ${formatDateOnly(range.start)} through ${formatDateOnly(range.end)} (collection date and trip date).` : 'Choose a valid date range to calculate totals.'}</p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? <SummarySkeletons /> : !error && validRange && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-lg">Total Collections</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">KES {totalCollections.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Total Expenses</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Total Profit</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalProfit.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Avg Per Driver</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-purple-600">KES {avgProfit.toLocaleString()}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Driver Leaderboard</CardTitle><CardDescription>Ranked by total profit in the selected range</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading driver leaderboard">
              <span className="sr-only">Loading driver leaderboard…</span>
              {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}
            </div>
          ) : error || !validRange ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Driver statistics could not be loaded.</p>
          ) : drivers.length === 0 ? (
            <div className="py-8 text-center text-gray-500"><p>No driver data yet</p></div>
          ) : (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Driver</TableHead><TableHead>Trips</TableHead><TableHead>Collections</TableHead><TableHead>Expenses</TableHead><TableHead>Profit</TableHead><TableHead>Avg Per Trip</TableHead></TableRow></TableHeader><TableBody>{drivers.map((driver, idx) => (<TableRow key={driver.driverId}><TableCell className="font-bold">{idx + 1}</TableCell><TableCell className="font-semibold">{driver.driverName}</TableCell><TableCell><Badge className="bg-blue-100 text-blue-800">{driver.trips}</Badge></TableCell><TableCell className="font-bold text-green-600">KES {driver.collections.toLocaleString()}</TableCell><TableCell className="font-bold text-red-600">KES {driver.expenses.toLocaleString()}</TableCell><TableCell className="font-bold text-blue-600">KES {driver.profit.toLocaleString()}</TableCell><TableCell>{driver.trips > 0 ? `KES ${Math.round(driver.profit / driver.trips).toLocaleString()}` : '—'}</TableCell></TableRow>))}</TableBody></Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
