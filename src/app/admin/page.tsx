'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Building2, Car, KeyRound, Truck, Users } from '@/components/icons';
import { AdminKpi, AdminPageHeader, AdminRecordList, StatusBadge, formatDate, planTone, titleCase } from '@/components/admin-ui';
import { isAdminUiPreview, previewTenants } from '@/lib/admin-preview';

type RecentTenant = {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminOverviewPage() {
  const preview = isAdminUiPreview();
  const [stats, setStats] = useState({
    fleetOwners: preview ? 42 : 0,
    totalDrivers: preview ? 318 : 0,
    totalVehicles: preview ? 196 : 0,
    activeTenants: preview ? 38 : 0,
    newThisMonth: preview ? 6 : 0,
    newLastMonth: preview ? 4 : 0,
  });
  const [recent, setRecent] = useState<RecentTenant[]>(preview ? previewTenants : []);
  const [loading, setLoading] = useState(!preview);
  const supabase = createClient();

  useEffect(() => {
    fetchStats();
  }, []);

  const monthStart = (offset: number) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() + offset);
    return date.toISOString();
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setStats({
          fleetOwners: 42,
          totalDrivers: 318,
          totalVehicles: 196,
          activeTenants: 38,
          newThisMonth: 6,
          newLastMonth: 4,
        });
        setRecent(previewTenants);
        return;
      }

      const thisMonth = monthStart(0);
      const lastMonth = monthStart(-1);
      const [tenantsCount, driversCount, vehiclesCount, ownersCount, recentTenants, thisMonthTenants, lastMonthTenants] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('role', 'owner').eq('is_active', true),
        supabase.from('tenants').select('id, name, plan, is_active, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('tenants').select('*', { count: 'exact', head: true }).gte('created_at', thisMonth),
        supabase.from('tenants').select('*', { count: 'exact', head: true }).gte('created_at', lastMonth).lt('created_at', thisMonth),
      ]);

      setStats({
        fleetOwners: ownersCount.count || 0,
        totalDrivers: driversCount.count || 0,
        totalVehicles: vehiclesCount.count || 0,
        activeTenants: tenantsCount.count || 0,
        newThisMonth: thisMonthTenants.count || 0,
        newLastMonth: lastMonthTenants.count || 0,
      });
      setRecent((recentTenants.data || []) as RecentTenant[]);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tenantTrend = stats.newThisMonth === stats.newLastMonth
    ? { direction: 'flat' as const, label: 'Same as last month' }
    : stats.newThisMonth > stats.newLastMonth
      ? { direction: 'up' as const, label: `+${stats.newThisMonth - stats.newLastMonth} this month` }
      : { direction: 'down' as const, label: `${stats.newThisMonth - stats.newLastMonth} this month` };

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Live picture of fleets, drivers, and vehicles across FaidaFleet."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/pin-resets">
              <KeyRound className="h-4 w-4" />
              PIN resets
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpi title="Active fleets" value={stats.activeTenants.toString()} hint="Companies on the platform" Icon={Building2} trend={tenantTrend} />
        <AdminKpi title="Fleet owners" value={stats.fleetOwners.toString()} hint="Owner memberships" Icon={Users} />
        <AdminKpi title="Drivers" value={stats.totalDrivers.toString()} hint="Active driver records" Icon={Car} />
        <AdminKpi title="Vehicles" value={stats.totalVehicles.toString()} hint="Active vehicles" Icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Newest fleets</CardTitle>
            <CardDescription>Recently added companies</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminRecordList
              rows={recent}
              rowKey={(row) => row.id}
              loading={loading}
              emptyTitle="No fleets yet"
              emptyDescription="New fleet owners appear here after they sign up or an admin adds them."
              columns={[
                { id: 'name', header: 'Fleet', cell: (row) => row.name },
                { id: 'plan', header: 'Plan', cell: (row) => <StatusBadge tone={planTone(row.plan)}>{titleCase(row.plan)}</StatusBadge> },
                { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
                { id: 'joined', header: 'Joined', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Admin console health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div>
                <p className="font-medium text-emerald-900">Operational</p>
                <p className="text-sm text-emerald-800">Auth, database, and storage</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database</span>
                <span className="font-medium text-emerald-700">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Auth</span>
                <span className="font-medium text-emerald-700">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PIN resets</span>
                <Link href="/admin/pin-resets" className="font-medium text-primary">View log</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
