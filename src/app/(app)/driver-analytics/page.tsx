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
  const [error, setError] = useState<string | null>(null);
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
  }, [accessLoading, tenantId]);

  const fetchData = async () => {
    try {
      setDataLoading(true);
      setError(null);
      if (!tenantId) throw new Error(accessError || 'No tenant found');

      const [driversRes, collectionsRes, tripsRes] = await Promise.all([
        supabase.from('drivers').select('id, full_name').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('collections').select('driver_id, amount').eq('tenant_id', tenantId),
        supabase.from('trips').select('driver_id, expenses').eq('tenant_id', tenantId),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (collectionsRes.error) throw collectionsRes.error;
      if (tripsRes.error) throw tripsRes.error;

      setDrivers(driverLeaderboard(
        (driversRes.data || []) as DriverInput[],
        (collectionsRes.data || []) as DriverCollection[],
        (tripsRes.data || []) as DriverTrip[],
      ));
    } catch (err: unknown) {
      setDrivers([]);
      setError(err instanceof Error ? err.message : 'Could not load the report');
    } finally {
      setDataLoading(false);
    }
  };

  const totalCollections = drivers.reduce((sum, driver) => sum + driver.collections, 0);
  const totalExpenses = drivers.reduce((sum, driver) => sum + driver.expenses, 0);
  const totalProfit = drivers.reduce((sum, driver) => sum + driver.profit, 0);
  const avgProfit = drivers.length > 0 ? Math.round(totalProfit / drivers.length) : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
      <div><h1 className="text-3xl font-bold">Driver Performance</h1><p className="text-gray-600 dark:text-gray-400">Collections minus the costs recorded on each driver&apos;s trips</p></div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? <SummarySkeletons /> : !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-lg">Total Collections</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">KES {totalCollections.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Total Expenses</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Total Profit</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalProfit.toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Avg Per Driver</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-purple-600">KES {avgProfit.toLocaleString()}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Driver Leaderboard</CardTitle><CardDescription>Ranked by total profit</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading driver leaderboard">
              <span className="sr-only">Loading driver leaderboard…</span>
              {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}
            </div>
          ) : error ? (
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
