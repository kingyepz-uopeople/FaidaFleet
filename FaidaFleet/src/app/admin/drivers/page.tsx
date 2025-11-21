'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, MoreHorizontal } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Driver = {
  id: string;
  full_name: string;
  phone: string;
  license_number: string | null;
  license_expiry: string | null;
  is_active: boolean;
  created_at: string;
  tenant_id: string;
  tenants?: { name: string } | null;
};

export default function AllDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    const filtered = drivers.filter((driver) =>
      driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery) ||
      driver.license_number?.includes(searchQuery)
    );
    setFilteredDrivers(filtered);
  }, [searchQuery, drivers]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('drivers')
        .select('*, tenants(name)')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setDrivers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  const toggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase
        .from('drivers')
        .update({ is_active: !currentStatus } as any)
        .eq('id', driverId);

      if (err) throw err;
      fetchDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver');
    }
  };

  const isLicenseExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Drivers</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage drivers across all fleet companies</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Search by name, phone, or license number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Drivers List</CardTitle>
          <CardDescription>Total: {filteredDrivers.length} drivers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Fleet Company</TableHead>
                    <TableHead>License Number</TableHead>
                    <TableHead>License Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDrivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.full_name}</TableCell>
                        <TableCell className="text-sm">{driver.phone}</TableCell>
                        <TableCell className="text-sm">
                          {driver.tenants?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{driver.license_number || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {driver.license_expiry ? (
                            <span className={isLicenseExpired(driver.license_expiry) ? 'text-red-600' : ''}>
                              {new Date(driver.license_expiry).toLocaleDateString()}
                              {isLicenseExpired(driver.license_expiry) && ' (Expired)'}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              driver.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300'
                            }
                          >
                            {driver.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(driver.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => toggleDriverStatus(driver.id, driver.is_active)}
                                className="cursor-pointer"
                              >
                                {driver.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
