'use client';
import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

type DriverStats = { driverId: string; driverName: string; collections: number; expenses: number; profit: number; trips: number };

export default function DriverAnalyticsPage() {
  const [drivers, setDrivers] = useState<DriverStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const membershipResp = await supabase.from('memberships').select('tenant_id').eq('user_id', user.id).eq('is_active', true).single();
      const membership: any = membershipResp.data;
      if (!membership) throw new Error('No tenant found');

      const [driversRes, collectionsRes, expensesRes, tripsRes] = await Promise.all([
        supabase.from('drivers').select('id, full_name').eq('tenant_id', membership.tenant_id).eq('is_active', true),
        supabase.from('collections').select('driver_id, amount').eq('tenant_id', membership.tenant_id),
        supabase.from('expenses').select('*').eq('tenant_id', membership.tenant_id),
        supabase.from('trips').select('driver_id').eq('tenant_id', membership.tenant_id)
      ]);

      const driversList: any[] = driversRes.data || [];
      const collections: any[] = collectionsRes.data || [];
      const allExpenses: any[] = expensesRes.data || [];
      const tripsList: any[] = tripsRes.data || [];

      const driverMap = new Map<string, DriverStats>();
      driversList.forEach(d => driverMap.set(d.id, { driverId: d.id, driverName: d.full_name, collections: 0, expenses: 0, profit: 0, trips: 0 }));

      collections.forEach(c => {
        const stats = driverMap.get(c.driver_id);
        if (stats) {
          stats.collections += parseFloat(c.amount);
          stats.profit = stats.collections - stats.expenses;
        }
      });

      tripsList.forEach(t => {
        const stats = driverMap.get(t.driver_id);
        if (stats) stats.trips += 1;
      });

      const driverStats = Array.from(driverMap.values()).sort((a, b) => b.profit - a.profit);
      setDrivers(driverStats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalCollections = drivers.reduce((sum, d) => sum + d.collections, 0);
  const totalExpenses = drivers.reduce((sum, d) => sum + d.expenses, 0);
  const totalProfit = drivers.reduce((sum, d) => sum + d.profit, 0);
  const avgProfit = drivers.length > 0 ? Math.round(totalProfit / drivers.length) : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div><h1 className="text-3xl font-bold">Driver Performance</h1><p className="text-gray-600 dark:text-gray-400">Analytics on driver earnings and productivity</p></div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-lg">Total Collections</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-green-600">KES {totalCollections.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Total Expenses</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Total Profit</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-600">KES {totalProfit.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Avg Per Driver</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-purple-600">KES {avgProfit.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Driver Leaderboard</CardTitle><CardDescription>Ranked by total profit</CardDescription></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div> : drivers.length === 0 ? <div className="text-center py-8 text-gray-500"><p>No driver data yet</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Driver</TableHead><TableHead>Trips</TableHead><TableHead>Collections</TableHead><TableHead>Expenses</TableHead><TableHead>Profit</TableHead><TableHead>Avg Per Trip</TableHead></TableRow></TableHeader><TableBody>{drivers.map((driver, idx) => (<TableRow key={driver.driverId}><TableCell className="font-bold">{idx + 1}</TableCell><TableCell className="font-semibold">{driver.driverName}</TableCell><TableCell><Badge className="bg-blue-100 text-blue-800">{driver.trips}</Badge></TableCell><TableCell className="text-green-600 font-bold">KES {driver.collections.toLocaleString()}</TableCell><TableCell className="text-red-600 font-bold">KES {driver.expenses.toLocaleString()}</TableCell><TableCell className="text-blue-600 font-bold">KES {driver.profit.toLocaleString()}</TableCell><TableCell>{driver.trips > 0 ? `KES ${Math.round(driver.profit / driver.trips).toLocaleString()}` : '—'}</TableCell></TableRow>))}</TableBody></Table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
