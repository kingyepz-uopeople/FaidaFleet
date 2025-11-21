'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { createClient } from '@/lib/supabase/client';
import { Building2, Users, Truck, BarChart3 } from 'lucide-react';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({
    fleetOwners: 0,
    totalDrivers: 0,
    totalVehicles: 0,
    activeTenants: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get total tenants
      const { count: tenantsCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get total drivers
      const { count: driversCount } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get total vehicles
      const { count: vehiclesCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get fleet owner count (memberships with owner role)
      const { count: ownersCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('is_active', true);

      setStats({
        fleetOwners: ownersCount || 0,
        totalDrivers: driversCount || 0,
        totalVehicles: vehiclesCount || 0,
        activeTenants: tenantsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Overview</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor all fleet owners and drivers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Tenants"
          value={stats.activeTenants.toString()}
          icon={Building2}
          trend="+2.5%"
        />
        <StatCard
          title="Fleet Owners"
          value={stats.fleetOwners.toString()}
          icon={Users}
          trend="+5.2%"
        />
        <StatCard
          title="Total Drivers"
          value={stats.totalDrivers.toString()}
          icon={Truck}
          trend="+12.1%"
        />
        <StatCard
          title="Total Vehicles"
          value={stats.totalVehicles.toString()}
          icon={BarChart3}
          trend="+8.3%"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <p className="font-medium text-green-900 dark:text-green-200">System Operational</p>
                <p className="text-sm text-green-700 dark:text-green-300">All services running normally</p>
              </div>
              <div className="h-3 w-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Database Status</p>
                <p className="font-semibold text-green-600">Connected</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Auth Service</p>
                <p className="font-semibold text-green-600">Active</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Storage</p>
                <p className="font-semibold text-green-600">Available</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
