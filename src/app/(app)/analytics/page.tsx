'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, Percent } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { lastNDateKeys, formatDateOnly } from '@/lib/dates';
import { groupFinancials, profitBreakdown, type MoneyRow } from '@/lib/fleet-metrics';
import { vehicleFuelEfficiency, type FuelFill } from '@/lib/fuel';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

export default function AnalyticsPage() {
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [fuelRows, setFuelRows] = useState<FuelRow[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const {
    loading: accessLoading,
    tenantId,
    loadError: accessError,
  } = useFleetAccess();
  const loading = dataLoading || accessLoading;

  useEffect(() => {
    if (!accessLoading) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, tenantId, dateRange]);

  const fetchData = async () => {
    try {
      setDataLoading(true);
      setError(null);
      if (!tenantId) throw new Error(accessError || 'No tenant found');

      const rangeDays = Number.parseInt(dateRange, 10);
      const startDate = lastNDateKeys(rangeDays + 1)[0];
      const [collectionsRes, expensesRes, fuelRes] = await Promise.all([
        supabase
          .from('collections')
          .select('date, amount')
          .eq('tenant_id', tenantId)
          .gte('date', startDate),
        supabase
          .from('expenses')
          .select('date, amount')
          .eq('tenant_id', tenantId)
          .gte('date', startDate),
        supabase
          .from('expenses')
          .select('id, vehicle_id, date, created_at, odometer_km, litres, amount, vehicles(registration_number)')
          .eq('tenant_id', tenantId)
          .eq('category', 'fuel')
          .not('vehicle_id', 'is', null),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (fuelRes.error) throw fuelRes.error;

      setReport(groupFinancials(
        (collectionsRes.data || []) as MoneyRow[],
        (expensesRes.data || []) as MoneyRow[],
      ));
      setFuelRows((fuelRes.data || []) as FuelRow[]);
    } catch (err: unknown) {
      setReport(null);
      setFuelRows([]);
      setError(err instanceof Error ? err.message : 'Could not load the report');
    } finally {
      setDataLoading(false);
    }
  };

  const efficiency = vehicleFuelEfficiency(fuelRows);
  const registrations = new Map(
    fuelRows.map((row) => [row.vehicle_id, row.vehicles?.registration_number || 'Vehicle removed']),
  );
  const slices = report ? profitBreakdown(report.totalProfit, report.totalExpenses) : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Financial analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Revenue, expenses, and profitability reports.</p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Date Range</CardTitle></CardHeader>
        <CardContent>
          <NativeSelect id="date_range" className="min-h-11 sm:w-56" value={dateRange} onChange={(event) => setDateRange(event.target.value)} disabled={loading}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </NativeSelect>
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

      {loading ? (
        <>
          <ChartSkeleton title="Revenue vs Expenses Trend" />
          <ChartSkeleton title="Fuel efficiency" />
        </>
      ) : report && (
        <>
          <Card>
            <CardHeader><CardTitle>Revenue vs Expenses Trend</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={report.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Legend /><Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" /><Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" /></LineChart></ResponsiveContainer></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Daily Profit Analysis</CardTitle></CardHeader>
            <CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={report.series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Legend /><Bar dataKey="profit" fill="#3b82f6" name="Daily Profit" /></BarChart></ResponsiveContainer></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Revenue Breakdown</CardTitle></CardHeader>
            <CardContent>{slices.length === 0 ? <p className="py-12 text-center text-gray-500">No revenue or expenses in this range.</p> : <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={slices} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: KES ${Number(value).toLocaleString()}`} outerRadius={100} dataKey="value">{slices.map((slice) => <Cell key={slice.name} fill={slice.name === 'Profit' ? '#10b981' : '#ef4444'} />)}</Pie></PieChart></ResponsiveContainer>}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fuel efficiency</CardTitle>
              <CardDescription>
                km/L uses the current fill&apos;s litres and the change from the previous recorded fuel odometer for that vehicle. Full-tank-to-full-tank fills are not assumed or tracked.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {efficiency.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No fuel entries with a vehicle have been recorded yet.</p>
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
        </>
      )}
    </div>
  );
}
