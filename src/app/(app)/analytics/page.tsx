'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, Percent } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { formatDateOnly } from '@/lib/dates';
import { groupFinancials, type MoneyRow } from '@/lib/fleet-metrics';
import { vehicleFuelEfficiency, type FuelFill } from '@/lib/fuel';
import { fetchReportPages, trailingDateRange, validReportRange } from '@/lib/report-range';

type FuelRow = FuelFill & {
  vehicles: { registration_number: string } | null;
};

type FinancialReport = ReturnType<typeof groupFinancials>;

function numberOrDash(value: number | null, maximumFractionDigits = 2): string {
  if (value === null) return '—';
  return value.toLocaleString('en-KE', { maximumFractionDigits });
}

function MetricCard({
  title,
  value,
  Icon,
  color,
}: {
  title: string;
  value: string;
  Icon: typeof DollarSign;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={`h-5 w-5 ${color}`} />{title}
        </CardTitle>
      </CardHeader>
      <CardContent><p className={`text-3xl font-bold ${color}`}>{value}</p></CardContent>
    </Card>
  );
}

function MetricSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4" role="status" aria-label="Loading financial totals">
      <span className="sr-only">Loading financial totals…</span>
      {[0, 1, 2, 3].map((item) => (
        <Card key={item}>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent><Skeleton className="h-9 w-36" /></CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
    </Card>
  );
}

const FinancialCharts = dynamic(() => import('./financial-charts'), {
  ssr: false,
  loading: () => <ChartSkeleton title="Revenue vs Expenses Trend" />,
});

export default function AnalyticsPage() {
  const [reportLoading, setReportLoading] = useState(true);
  const [fuelLoading, setFuelLoading] = useState(true);
  const [reportKeyLoaded, setReportKeyLoaded] = useState('');
  const [fuelKeyLoaded, setFuelKeyLoaded] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [fuelError, setFuelError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [reportToday, setReportToday] = useState<Date | null>(null);
  const [fuelDays, setFuelDays] = useState('365');
  const [customFuelRange, setCustomFuelRange] = useState({ start: '', end: '' });
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [fuelRows, setFuelRows] = useState<FuelRow[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    tenantId,
    loadError: accessError,
  } = useFleetAccess();
  // Keep the financial report's existing inclusive start and future-date
  // semantics; the explicit label below describes exactly what it includes.
  const financialStart = reportToday ? trailingDateRange(Number.parseInt(dateRange, 10) + 1, reportToday).start : '';
  const fuelRange = reportToday
    ? fuelDays === 'custom' ? customFuelRange : trailingDateRange(Number.parseInt(fuelDays, 10), reportToday)
    : { start: '', end: '' };
  const reportReady = Boolean(reportToday);
  const validFuelRange = reportReady && validReportRange(fuelRange);
  const reportKey = `${tenantId || ''}:${financialStart}`;
  const fuelKey = `${tenantId || ''}:${fuelRange.start}:${fuelRange.end}`;
  const loading = reportLoading || accessLoading || (Boolean(financialStart) && reportKeyLoaded !== reportKey);
  const loadingFuel = fuelLoading || accessLoading || (validFuelRange && fuelKeyLoaded !== fuelKey);

  // Server and browser may be on different calendar days. Resolve the local
  // reporting date after hydration so labels and queries use the browser's day.
  useEffect(() => {
    const today = new Date();
    setReportToday(today);
    setCustomFuelRange(trailingDateRange(365, today));
  }, []);

  useEffect(() => {
    if (accessLoading || !financialStart) return;
    const controller = new AbortController();
    const fetchFinancials = async () => {
      try {
        setReportLoading(true);
        setReportError(null);
        if (!tenantId) throw new Error(accessError || 'No tenant found');

        const [collections, expenses] = await Promise.all([
          fetchReportPages((from, to) => supabase.from('collections')
            .select('id, date, amount', { count: from === 0 ? 'exact' : undefined }).eq('tenant_id', tenantId).gte('date', financialStart)
            .order('date').order('id').range(from, to).abortSignal(controller.signal)),
          fetchReportPages((from, to) => supabase.from('expenses')
            .select('id, date, amount', { count: from === 0 ? 'exact' : undefined }).eq('tenant_id', tenantId).gte('date', financialStart)
            .order('date').order('id').range(from, to).abortSignal(controller.signal)),
        ]);
        if (!controller.signal.aborted) {
          setReport(groupFinancials(collections as MoneyRow[], expenses as MoneyRow[]));
          setReportKeyLoaded(reportKey);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setReport(null);
        setReportKeyLoaded(reportKey);
        setReportError(err instanceof Error ? err.message : 'Could not load the report');
      } finally {
        if (!controller.signal.aborted) setReportLoading(false);
      }
    };
    void fetchFinancials();
    return () => controller.abort();
  }, [accessLoading, accessError, tenantId, financialStart, reportKey, supabase]);

  useEffect(() => {
    if (accessLoading || !reportReady) return;
    if (!validFuelRange) {
      setFuelRows([]);
      setFuelKeyLoaded('');
      setFuelError('Choose valid start and end dates in chronological order.');
      setFuelLoading(false);
      return;
    }
    const controller = new AbortController();
    const fetchFuel = async () => {
      try {
        setFuelLoading(true);
        setFuelError(null);
        if (!tenantId) throw new Error(accessError || 'No tenant found');

        const rows = await fetchReportPages((from, to) => supabase.from('expenses')
          .select('id, vehicle_id, date, created_at, odometer_km, litres, amount, vehicles(registration_number)', { count: from === 0 ? 'exact' : undefined })
          .eq('tenant_id', tenantId).eq('category', 'fuel').not('vehicle_id', 'is', null)
          .gte('date', fuelRange.start).lte('date', fuelRange.end)
          .order('date').order('created_at').order('id')
          .range(from, to).abortSignal(controller.signal));
        if (!controller.signal.aborted) {
          setFuelRows(rows as FuelRow[]);
          setFuelKeyLoaded(fuelKey);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setFuelRows([]);
        setFuelKeyLoaded(fuelKey);
        setFuelError(err instanceof Error ? err.message : 'Could not load fuel efficiency');
      } finally {
        if (!controller.signal.aborted) setFuelLoading(false);
      }
    };
    void fetchFuel();
    return () => controller.abort();
  }, [accessLoading, accessError, tenantId, reportReady, validFuelRange, fuelRange.start, fuelRange.end, fuelKey, supabase]);

  const efficiency = vehicleFuelEfficiency(fuelRows);
  const registrations = new Map(
    fuelRows.map((row) => [row.vehicle_id, row.vehicles?.registration_number || 'Vehicle removed']),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Financial analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Revenue, expenses, and profitability reports.</p>
      </div>

      {reportError && <Alert variant="destructive"><AlertDescription>{reportError}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Date Range</CardTitle></CardHeader>
        <CardContent>
          <NativeSelect id="date_range" className="min-h-11 sm:w-56" value={dateRange} onChange={(event) => { setReportToday(new Date()); setDateRange(event.target.value); }} disabled={loading}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </NativeSelect>
          <p className="mt-2 text-sm text-muted-foreground">{financialStart ? `Financial totals include entries from ${formatDateOnly(financialStart)} onward, including future-dated entries.` : 'Financial totals include entries from the selected start date onward.'}</p>
        </CardContent>
      </Card>

      {loading ? <MetricSkeletons /> : report && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard title="Total Revenue" value={`KES ${report.totalRevenue.toLocaleString()}`} Icon={DollarSign} color="text-green-600" />
          <MetricCard title="Total Expenses" value={`KES ${report.totalExpenses.toLocaleString()}`} Icon={TrendingDown} color="text-red-600" />
          <MetricCard title="Net Profit" value={`KES ${report.totalProfit.toLocaleString()}`} Icon={TrendingUp} color="text-blue-600" />
          <MetricCard title="Profit Margin" value={`${report.profitMargin}%`} Icon={Percent} color="text-purple-600" />
        </div>
      )}

      {(loading || report) && <FinancialCharts report={loading ? null : report} />}

      <Card>
        <CardHeader>
          <CardTitle>Fuel efficiency</CardTitle>
          <CardDescription>
            km/L uses the current fill&apos;s litres and the change from the previous recorded fuel odometer for that vehicle. Full-tank-to-full-tank fills are not assumed or tracked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="fuel_range" className="text-sm text-muted-foreground">Fuel reporting range</label>
          <NativeSelect id="fuel_range" className="mt-2 min-h-11 sm:w-56" value={fuelDays} onChange={(event) => { setReportToday(new Date()); setFuelDays(event.target.value); }} disabled={accessLoading}>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
            <option value="730">Last 730 days</option>
            <option value="1825">Last 1,825 days</option>
            <option value="custom">Custom dates</option>
          </NativeSelect>
          {fuelDays === 'custom' && (
            <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
              <div><label htmlFor="fuel_start" className="text-sm text-muted-foreground">From</label><Input id="fuel_start" type="date" value={customFuelRange.start} onChange={(event) => setCustomFuelRange((current) => ({ ...current, start: event.target.value }))} /></div>
              <div><label htmlFor="fuel_end" className="text-sm text-muted-foreground">Through</label><Input id="fuel_end" type="date" value={customFuelRange.end} onChange={(event) => setCustomFuelRange((current) => ({ ...current, end: event.target.value }))} /></div>
            </div>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{!reportToday ? 'Loading fuel reporting range…' : validFuelRange ? `Fills from ${formatDateOnly(fuelRange.start)} through ${formatDateOnly(fuelRange.end)}. A vehicle's first fill in this range has no earlier reading for comparison.` : 'Choose a valid date range to calculate fuel efficiency.'}</p>
          {loadingFuel ? (
            <Skeleton className="mt-4 h-[120px] w-full" aria-label="Loading fuel efficiency" />
          ) : !validFuelRange ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Choose a valid date range to calculate fuel efficiency.</p>
          ) : fuelError ? (
            <Alert variant="destructive" className="mt-4"><AlertDescription>{fuelError}</AlertDescription></Alert>
          ) : efficiency.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No fuel entries with a vehicle were recorded in this range.</p>
          ) : (
            <ul className="divide-y">
              {efficiency.map((summary) => (
                <li key={summary.vehicleId} className="py-4 first:pt-0 last:pb-0">
                  <p className="font-semibold">{registrations.get(summary.vehicleId) || 'Vehicle removed'}</p>
                  <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Average km/L</dt>
                      <dd className="mt-1 font-medium">{numberOrDash(summary.averageKmPerLitre)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Cost per km</dt>
                      <dd className="mt-1 font-medium">{summary.averageCostPerKm === null ? '—' : `KES ${numberOrDash(summary.averageCostPerKm)}`}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last fill</dt>
                      <dd className="mt-1 font-medium">
                        {formatDateOnly(summary.lastFill.date)} · KES {summary.lastFill.amount.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  {summary.flaggedFills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Needs attention</p>
                      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Fills more than 30 percent below average efficiency">
                        {summary.flaggedFills.map((fill) => (
                          <li key={fill.id}>
                            <Badge variant="destructive">
                              {formatDateOnly(fill.date)} · {numberOrDash(fill.km_per_litre)} km/L
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
