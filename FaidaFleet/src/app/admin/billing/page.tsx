'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        supabase
          .from('tenants')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('plans').select('*'),
      ]);

      setTenants(tenantsRes.data || []);

      // Create plan price map
      const planMap: Record<string, Plan> = {};
      plansRes.data?.forEach((p: any) => {
        planMap[p.name.toLowerCase()] = p;
      });
      setPlans(planMap);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan: string) => {
    const lower = plan.toLowerCase();
    switch (lower) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanPrice = (plan: string) => {
    const lower = plan.toLowerCase();
    return plans[lower]?.price || 0;
  };

  const totalMonthlyRevenue = tenants.reduce((sum, t) => sum + getPlanPrice(t.plan), 0);
  const planCounts = {
    starter: tenants.filter((t) => t.plan === 'starter').length,
    pro: tenants.filter((t) => t.plan === 'pro').length,
    enterprise: tenants.filter((t) => t.plan === 'enterprise').length,
  };

  const starterPrice = getPlanPrice('starter');
  const proPrice = getPlanPrice('pro');
  const enterprisePrice = getPlanPrice('enterprise');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Subscriptions</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor fleet owner subscriptions and revenue</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {totalMonthlyRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-2">From active subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Starter Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{planCounts.starter}</p>
            <p className="text-sm text-gray-500">{starterPrice === 0 ? 'Free' : `KES ${starterPrice}/month`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pro Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{planCounts.pro}</p>
            <p className="text-sm text-gray-500">KES {(planCounts.pro * proPrice).toLocaleString()}/month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enterprise Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{planCounts.enterprise}</p>
            <p className="text-sm text-gray-500">KES {(planCounts.enterprise * enterprisePrice).toLocaleString()}/month</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Owner Subscriptions</CardTitle>
          <CardDescription>Current billing status - {tenants.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fleet Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <Badge className={getPlanColor(tenant.plan)}>
                          {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>KES {getPlanPrice(tenant.plan).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border-l-4 border-gray-100 pl-4">
            <p className="text-sm text-gray-600">Starter Revenue</p>
            <p className="text-2xl font-bold mt-2">KES {(planCounts.starter * starterPrice).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{planCounts.starter} fleets</p>
          </div>
          <div className="border-l-4 border-blue-400 pl-4">
            <p className="text-sm text-gray-600">Pro Revenue</p>
            <p className="text-2xl font-bold mt-2">KES {(planCounts.pro * proPrice).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{planCounts.pro} fleets</p>
          </div>
          <div className="border-l-4 border-purple-400 pl-4">
            <p className="text-sm text-gray-600">Enterprise Revenue</p>
            <p className="text-2xl font-bold mt-2">KES {(planCounts.enterprise * enterprisePrice).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{planCounts.enterprise} fleets</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
