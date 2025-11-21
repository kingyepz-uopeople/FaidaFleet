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
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [fleets, drivers, vehicles, collections] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('collections').select('amount'),
      ]);

      const totalCollections = collections.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      setStats({
        totalFleets: fleets.count || 0,
        activeFleets: fleets.data?.filter((f: any) => f.is_active).length || 0,
        totalDrivers: drivers.count || 0,
        totalVehicles: vehicles.count || 0,
        totalCollections,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = [
    { name: 'Week 1', collections: 45000, expenses: 12000 },
    { name: 'Week 2', collections: 52000, expenses: 14000 },
    { name: 'Week 3', collections: 48000, expenses: 11000 },
    { name: 'Week 4', collections: 61000, expenses: 15000 },
  ];

  const planDistribution = [
    { name: 'Starter', value: 45 },
    { name: 'Pro', value: 35 },
    { name: 'Enterprise', value: 20 },
  ];

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899'];

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
            <CardTitle>Collections vs Expenses</CardTitle>
            <CardDescription>Weekly performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="collections" stroke="#3b82f6" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" />
              </LineChart>
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

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue Trend</CardTitle>
          <CardDescription>Last 30 days performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="collections" fill="#3b82f6" />
              <Bar dataKey="expenses" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
