'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Users, Truck, DollarSign } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalFleets: 0,
    activeFleets: 0,
    totalDrivers: 0,
    totalVehicles: 0,
    totalCollections: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [planDistribution, setPlanDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Get system stats
      const [fleets, drivers, vehicles, collections, plans] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('collections').select('amount, date'),
        supabase.from('tenants').select('plan'),
      ]);

      const totalCollections = collections.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      setStats({
        totalFleets: fleets.count || 0,
        activeFleets: fleets.data?.filter((f: any) => f.is_active).length || 0,
        totalDrivers: drivers.count || 0,
        totalVehicles: vehicles.count || 0,
        totalCollections,
      });

      // Calculate plan distribution
      const planCounts = {
        Starter: plans.data?.filter((p: any) => p.plan === 'starter').length || 0,
        Pro: plans.data?.filter((p: any) => p.plan === 'pro').length || 0,
        Enterprise: plans.data?.filter((p: any) => p.plan === 'enterprise').length || 0,
      };

      const total = Object.values(planCounts).reduce((a, b) => a + b, 0) || 1;
      setPlanDistribution([
        { name: 'Starter', value: Math.round((planCounts.Starter / total) * 100) },
        { name: 'Pro', value: Math.round((planCounts.Pro / total) * 100) },
        { name: 'Enterprise', value: Math.round((planCounts.Enterprise / total) * 100) },
      ]);

      // Calculate weekly data from collections
      const last4Weeks = generateWeeklyChart(collections.data || []);
      setChartData(last4Weeks);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyChart = (collections: any[]) => {
    const weeks = [];
    const today = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - i * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCollections = collections
        .filter((c) => {
          const date = new Date(c.date);
          return date >= weekStart && date < weekEnd;
        })
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      weeks.push({
        name: `Week ${4 - i}`,
        collections: weekCollections / 1000,
        expenses: Math.random() * 20,
      });
    }

    return weeks;
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899'];

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading analytics...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400">Platform-wide statistics and insights</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Fleets" value={stats.totalFleets.toString()} description="All fleet companies" Icon={TrendingUp} />
        <StatCard title="Active Fleets" value={stats.activeFleets.toString()} description="Currently active" Icon={Users} />
        <StatCard title="Total Drivers" value={stats.totalDrivers.toString()} description="System-wide" Icon={Truck} />
        <StatCard title="Total Vehicles" value={stats.totalVehicles.toString()} description="Active vehicles" Icon={Truck} />
        <StatCard title="Total Collections" value={`KES ${(stats.totalCollections / 1000).toFixed(0)}K`} description="All time" Icon={DollarSign} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Collections</CardTitle>
            <CardDescription>Last 4 weeks performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="collections" fill="#3b82f6" name="Collections (KES 000s)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Fleet owners by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={planDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
            <p className="text-2xl font-bold">KES {(stats.totalCollections / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Fleet Utilization</p>
            <p className="text-2xl font-bold">{stats.totalFleets > 0 ? Math.round((stats.activeFleets / stats.totalFleets) * 100) : 0}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Drivers/Fleet</p>
            <p className="text-2xl font-bold">{stats.totalFleets > 0 ? Math.round(stats.totalDrivers / stats.totalFleets) : 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Vehicles/Fleet</p>
            <p className="text-2xl font-bold">{stats.totalFleets > 0 ? Math.round(stats.totalVehicles / stats.totalFleets) : 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
