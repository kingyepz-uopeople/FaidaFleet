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

const PLAN_PRICES: Record<string, number> = {
  starter: 0,
  pro: 99,
  enterprise: 299,
};

export default function BillingPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalMonthlyRevenue = tenants.reduce((sum, t) => sum + PLAN_PRICES[t.plan] || 0, 0);
  const planCounts = {
    starter: tenants.filter((t) => t.plan === 'starter').length,
    pro: tenants.filter((t) => t.plan === 'pro').length,
    enterprise: tenants.filter((t) => t.plan === 'enterprise').length,
  };

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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Starter Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{planCounts.starter}</p>
            <p className="text-sm text-gray-500">Free</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pro Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{planCounts.pro}</p>
            <p className="text-sm text-gray-500">KES {(planCounts.pro * PLAN_PRICES.pro).toLocaleString()}/month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enterprise Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{planCounts.enterprise}</p>
            <p className="text-sm text-gray-500">KES {(planCounts.enterprise * PLAN_PRICES.enterprise).toLocaleString()}/month</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Owner Subscriptions</CardTitle>
          <CardDescription>Current billing status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fleet Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly Cost</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
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
                      <TableCell>
                        <span className="font-semibold">
                          {PLAN_PRICES[tenant.plan] === 0
                            ? 'Free'
                            : `KES ${PLAN_PRICES[tenant.plan]}`}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
