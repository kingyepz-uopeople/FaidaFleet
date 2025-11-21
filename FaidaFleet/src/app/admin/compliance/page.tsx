'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

type Driver = {
  id: string;
  full_name: string;
  license_expiry: string | null;
  license_number: string | null;
  tenants: { name: string };
};

type Vehicle = {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  tenants: { name: string };
};

export default function CompliancePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      const [driversRes, vehiclesRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, full_name, license_expiry, license_number, tenants(name)')
          .eq('is_active', true),
        supabase
          .from('vehicles')
          .select('id, registration_number, make, model, tenants(name)')
          .eq('is_active', true),
      ]);

      setDrivers(driversRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const getDaysToExpiry = (date: string | null) => {
    if (!date) return null;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry;
  };

  const expiredLicenses = drivers.filter((d) => isExpired(d.license_expiry));
  const expiringSoon = drivers.filter((d) => isExpiringSoon(d.license_expiry));
  const compliantDrivers = drivers.filter(
    (d) => !isExpired(d.license_expiry) && !isExpiringSoon(d.license_expiry)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Compliance & Alerts</h1>
        <p className="text-gray-600 dark:text-gray-400">Driver and vehicle compliance monitoring</p>
      </div>

      {expiredLicenses.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 font-medium">
            ⚠ {expiredLicenses.length} drivers have expired licenses - immediate action required
          </AlertDescription>
        </Alert>
      )}

      {expiringSoon.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 font-medium">
            ⚠ {expiringSoon.length} drivers have licenses expiring within 30 days
          </AlertDescription>
        </Alert>
      )}

      {compliantDrivers.length > 0 && expiredLicenses.length === 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 font-medium">
            ✓ All drivers are compliant
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{drivers.length}</p>
            <p className="text-sm text-gray-500">Active drivers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expired Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{expiredLicenses.length}</p>
            <p className="text-sm text-red-500">Action needed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{expiringSoon.length}</p>
            <p className="text-sm text-yellow-500">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compliant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{compliantDrivers.length}</p>
            <p className="text-sm text-green-500">Good standing</p>
          </CardContent>
        </Card>
      </div>

      {/* Expired Licenses */}
      {expiredLicenses.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle>Expired Licenses</CardTitle>
            <CardDescription className="text-red-700">Requires immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>License #</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Expired Since</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredLicenses.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.full_name}</TableCell>
                      <TableCell className="text-sm">{driver.license_number || 'N/A'}</TableCell>
                      <TableCell>{driver.tenants?.name}</TableCell>
                      <TableCell>
                        {driver.license_expiry
                          ? new Date(driver.license_expiry).toLocaleDateString()
                          : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-red-100 text-red-800">Expired</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring Soon */}
      {expiringSoon.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle>Licenses Expiring Soon</CardTitle>
            <CardDescription className="text-yellow-700">Renewal needed within 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>License #</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Expires In</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringSoon.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.full_name}</TableCell>
                      <TableCell className="text-sm">{driver.license_number || 'N/A'}</TableCell>
                      <TableCell>{driver.tenants?.name}</TableCell>
                      <TableCell>
                        <span className="font-semibold">{getDaysToExpiry(driver.license_expiry)} days</span>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800">Expiring Soon</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliant Drivers */}
      {compliantDrivers.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle>Compliant Drivers</CardTitle>
            <CardDescription>Licenses valid and up to date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>License #</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compliantDrivers.slice(0, 10).map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.full_name}</TableCell>
                      <TableCell className="text-sm">{driver.license_number || 'N/A'}</TableCell>
                      <TableCell>{driver.tenants?.name}</TableCell>
                      <TableCell>
                        {driver.license_expiry
                          ? new Date(driver.license_expiry).toLocaleDateString()
                          : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {compliantDrivers.length > 10 && (
              <p className="text-sm text-gray-500 mt-4">
                Showing 10 of {compliantDrivers.length} compliant drivers
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
