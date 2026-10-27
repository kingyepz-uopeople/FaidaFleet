'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Building2, Car, DollarSign, Users } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminKpi, AdminLoading, AdminPageHeader, formatKes } from '@/components/admin-ui';
import { isAdminUiPreview } from '@/lib/admin-preview';

const AnalyticsCharts = dynamic(() => import('./analytics-charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-label="Loading analytics charts">
      {[['Weekly collections', 'Last 4 weeks, in thousands of KES'], ['Plan mix', 'Fleet owners by plan']].map(([title, description]) => (
        <Card key={title}>
          <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
          <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
        </Card>
      ))}
    </div>
  ),
});

export default function AnalyticsPage() {
  const preview = isAdminUiPreview();
  const [stats, setStats] = useState({
    totalFleets: preview ? 41 : 0,
    activeFleets: preview ? 38 : 0,
    totalDrivers: preview ? 318 : 0,
    totalVehicles: preview ? 196 : 0,
    totalCollections: preview ? 4820000 : 0,
  });
  const [chartData, setChartData] = useState<{ name: string; collections: number }[]>(
    preview
      ? [
          { name: 'Week 1', collections: 980 },
          { name: 'Week 2', collections: 1120 },
          { name: 'Week 3', collections: 870 },
          { name: 'Week 4', collections: 1340 },
        ]
      : [],
  );
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number }[]>(
    preview
      ? [
          { name: 'Starter', value: 45 },
          { name: 'Pro', value: 40 },
          { name: 'Enterprise', value: 15 },
        ]
      : [],
  );
  const [loading, setLoading] = useState(!preview);
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      if (isAdminUiPreview()) {
        setStats({ totalFleets: 41, activeFleets: 38, totalDrivers: 318, totalVehicles: 196, totalCollections: 4820000 });
        setPlanDistribution([{ name: 'Starter', value: 45 }, { name: 'Pro', value: 40 }, { name: 'Enterprise', value: 15 }]);
        setChartData([
          { name: 'Week 1', collections: 980 },
          { name: 'Week 2', collections: 1120 },
          { name: 'Week 3', collections: 870 },
          { name: 'Week 4', collections: 1340 },
        ]);
        return;
      }

      const [fleets, activeFleets, drivers, vehicles, collections, plans] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('collections').select('amount, date'),
        supabase.from('tenants').select('plan'),
      ]);

      const totalCollections = collections.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      setStats({
        totalFleets: fleets.count || 0,
        activeFleets: activeFleets.count || 0,
        totalDrivers: drivers.count || 0,
        totalVehicles: vehicles.count || 0,
        totalCollections,
      });

      const planCounts = {
        Starter: plans.data?.filter((p) => p.plan === 'starter').length || 0,
        Pro: plans.data?.filter((p) => p.plan === 'pro').length || 0,
        Enterprise: plans.data?.filter((p) => p.plan === 'enterprise').length || 0,
      };

      const total = Object.values(planCounts).reduce((a, b) => a + b, 0) || 1;
      setPlanDistribution([
        { name: 'Starter', value: Math.round((planCounts.Starter / total) * 100) },
        { name: 'Pro', value: Math.round((planCounts.Pro / total) * 100) },
        { name: 'Enterprise', value: Math.round((planCounts.Enterprise / total) * 100) },
      ]);

      setChartData(generateWeeklyChart(collections.data || []));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyChart = (collections: { amount?: number; date?: string }[]) => {
    const weeks = [];
    const today = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCollections = collections
        .filter((c) => {
          const date = new Date(c.date || '');
          return date >= weekStart && date < weekEnd;
        })
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      weeks.push({
        name: `Week ${4 - i}`,
        collections: Math.round(weekCollections / 1000),
      });
    }

    return weeks;
  };

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Analytics" description="Platform-wide statistics and insights" />
        <AdminLoading rows={6} />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Analytics" description="Platform-wide statistics and insights" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminKpi title="Total fleets" value={stats.totalFleets.toString()} hint="All companies" Icon={Building2} />
        <AdminKpi title="Active fleets" value={stats.activeFleets.toString()} hint="Currently active" Icon={Users} />
        <AdminKpi title="Drivers" value={stats.totalDrivers.toString()} hint="System-wide" Icon={Car} />
        <AdminKpi title="Vehicles" value={stats.totalVehicles.toString()} hint="Active vehicles" Icon={Car} />
        <AdminKpi title="Collections" value={formatKes(stats.totalCollections)} hint="All time" Icon={DollarSign} />
      </div>

      <AnalyticsCharts chartData={chartData} planDistribution={planDistribution} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpi title="Total collections" value={formatKes(stats.totalCollections)} />
        <AdminKpi title="Fleet utilization" value={`${stats.totalFleets > 0 ? Math.round((stats.activeFleets / stats.totalFleets) * 100) : 0}%`} />
        <AdminKpi title="Avg drivers / fleet" value={`${stats.totalFleets > 0 ? Math.round(stats.totalDrivers / stats.totalFleets) : 0}`} />
        <AdminKpi title="Avg vehicles / fleet" value={`${stats.totalFleets > 0 ? Math.round(stats.totalVehicles / stats.totalFleets) : 0}`} />
      </div>
    </>
  );
}
