'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { AdminFeedback, AdminKpi, AdminPageHeader, AdminRecordList, AdminSearch, StatusBadge, formatDate, formatKes, planTone, titleCase } from '@/components/admin-ui';
import { isAdminUiPreview, previewPlans, previewTenants } from '@/lib/admin-preview';

type Tenant = {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  created_at: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
};

export default function BillingPage() {
  const preview = isAdminUiPreview();
  const [tenants, setTenants] = useState<Tenant[]>(preview ? previewTenants : []);
  const [plans, setPlans] = useState<Record<string, Plan>>(() => {
    if (!preview) return {};
    const planMap: Record<string, Plan> = {};
    previewPlans.forEach((p) => { planMap[p.name.toLowerCase()] = p; });
    return planMap;
  });
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      if (isAdminUiPreview()) {
        setTenants(previewTenants);
        const planMap: Record<string, Plan> = {};
        previewPlans.forEach((p) => { planMap[p.name.toLowerCase()] = p; });
        setPlans(planMap);
        return;
      }
      const [tenantsRes, plansRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('plans').select('*'),
      ]);

      if (tenantsRes.error) throw tenantsRes.error;
      if (plansRes.error) throw plansRes.error;

      setTenants(tenantsRes.data || []);
      const planMap: Record<string, Plan> = {};
      plansRes.data?.forEach((p) => {
        planMap[p.name.toLowerCase()] = p;
      });
      setPlans(planMap);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load billing data.');
    } finally {
      setLoading(false);
    }
  };

  const getPlanPrice = (plan: string) => plans[plan.toLowerCase()]?.price || 0;

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    if (!needle) return tenants;
    return tenants.filter((t) => t.name.toLowerCase().includes(needle) || t.plan.toLowerCase().includes(needle));
  }, [query, tenants]);

  const totalMonthlyRevenue = tenants.reduce((sum, t) => sum + getPlanPrice(t.plan), 0);
  const planCounts = {
    starter: tenants.filter((t) => t.plan === 'starter').length,
    pro: tenants.filter((t) => t.plan === 'pro').length,
    enterprise: tenants.filter((t) => t.plan === 'enterprise').length,
  };

  return (
    <>
      <AdminPageHeader title="Billing" description="Subscriptions and monthly plan revenue across fleets." />
      <AdminFeedback error={loadError} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpi title="Monthly revenue" value={formatKes(totalMonthlyRevenue)} hint="From current plans" />
        <AdminKpi title="Starter" value={String(planCounts.starter)} hint={getPlanPrice('starter') === 0 ? 'Free' : `${formatKes(getPlanPrice('starter'))}/mo`} />
        <AdminKpi title="Pro" value={String(planCounts.pro)} hint={`${formatKes(planCounts.pro * getPlanPrice('pro'))}/mo`} />
        <AdminKpi title="Enterprise" value={String(planCounts.enterprise)} hint={`${formatKes(planCounts.enterprise * getPlanPrice('enterprise'))}/mo`} />
      </div>

      <AdminSearch value={query} onChange={setQuery} placeholder="Search fleet or plan…" />

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>{filtered.length} fleets</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminRecordList
            rows={filtered}
            rowKey={(row) => row.id}
            loading={loading}
            emptyTitle="No subscriptions"
            emptyDescription="Fleet plans appear here after companies are added."
            columns={[
              { id: 'name', header: 'Fleet', cell: (row) => <span className="font-medium">{row.name}</span> },
              { id: 'plan', header: 'Plan', cell: (row) => <StatusBadge tone={planTone(row.plan)}>{titleCase(row.plan)}</StatusBadge> },
              { id: 'cost', header: 'Monthly', cell: (row) => formatKes(getPlanPrice(row.plan)) },
              { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
              { id: 'since', header: 'Since', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
            ]}
          />
        </CardContent>
      </Card>
    </>
  );
}
