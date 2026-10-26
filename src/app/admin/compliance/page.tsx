'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, CheckCircle, Clock } from '@/components/icons';
import { AdminFeedback, AdminKpi, AdminPageHeader, AdminRecordList, AdminSearch, StatusBadge, formatDate } from '@/components/admin-ui';
import { toastError } from '@/lib/toast';
import { isAdminUiPreview, previewDrivers } from '@/lib/admin-preview';

type Driver = {
  id: string;
  full_name: string;
  license_expiry: string | null;
  license_number: string | null;
  tenants: { name: string };
};

export default function CompliancePage() {
  const preview = isAdminUiPreview();
  const [drivers, setDrivers] = useState<Driver[]>(
    preview
      ? previewDrivers.map((d) => ({
          id: d.id,
          full_name: d.full_name,
          license_expiry: d.license_expiry,
          license_number: d.license_number,
          tenants: d.tenants,
        }))
      : [],
  );
  const [loading, setLoading] = useState(!preview);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      if (isAdminUiPreview()) {
        setDrivers(previewDrivers.map((d) => ({ id: d.id, full_name: d.full_name, license_expiry: d.license_expiry, license_number: d.license_number, tenants: d.tenants })));
        return;
      }
      const { data, error: loadError } = await supabase
        .from('drivers')
        .select('id, full_name, license_expiry, license_number, tenants(name)')
        .eq('is_active', true);
      if (loadError) throw loadError;
      setDrivers((data || []) as Driver[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load compliance data';
      setError(message);
      toastError(message, 'Could not load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (date: string | null) => Boolean(date && new Date(date) < new Date());
  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 30 && days > 0;
  };
  const getDaysToExpiry = (date: string | null) => {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const needle = query.toLowerCase();
  const visible = useMemo(
    () => drivers.filter((d) => !needle || d.full_name.toLowerCase().includes(needle) || d.tenants?.name?.toLowerCase().includes(needle)),
    [drivers, needle],
  );

  const expiredLicenses = visible.filter((d) => isExpired(d.license_expiry));
  const expiringSoon = visible.filter((d) => isExpiringSoon(d.license_expiry));
  const compliantDrivers = visible.filter((d) => !isExpired(d.license_expiry) && !isExpiringSoon(d.license_expiry));

  const columns = (kind: 'expired' | 'soon' | 'ok') => [
    { id: 'name', header: 'Driver', cell: (driver: Driver) => <span className="font-medium">{driver.full_name}</span> },
    { id: 'license', header: 'License', cell: (driver: Driver) => driver.license_number || '—' },
    { id: 'fleet', header: 'Fleet', cell: (driver: Driver) => driver.tenants?.name || '—' },
    {
      id: 'expiry',
      header: kind === 'soon' ? 'Expires in' : 'Expiry',
      cell: (driver: Driver) => (kind === 'soon' ? `${getDaysToExpiry(driver.license_expiry)} days` : formatDate(driver.license_expiry)),
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => (
        <StatusBadge tone={kind === 'expired' ? 'danger' : kind === 'soon' ? 'warning' : 'success'}>
          {kind === 'expired' ? 'Expired' : kind === 'soon' ? 'Expiring soon' : 'Compliant'}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title="Compliance" description="Driver licence expiry across every fleet." />
      <AdminFeedback error={error} />
      <AdminSearch value={query} onChange={setQuery} placeholder="Search driver or fleet…" />

      {expiredLicenses.length > 0 && (
        <Alert className="border-rose-200 bg-rose-50">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <AlertDescription className="font-medium text-rose-800">
            {expiredLicenses.length} drivers have expired licences.
          </AlertDescription>
        </Alert>
      )}
      {expiringSoon.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="font-medium text-amber-800">
            {expiringSoon.length} licences expire within 30 days.
          </AlertDescription>
        </Alert>
      )}
      {compliantDrivers.length > 0 && expiredLicenses.length === 0 && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="font-medium text-emerald-800">All visible drivers are compliant.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpi title="Drivers" value={String(visible.length)} hint="Active" />
        <AdminKpi title="Expired" value={String(expiredLicenses.length)} hint="Action needed" />
        <AdminKpi title="Expiring soon" value={String(expiringSoon.length)} hint="Next 30 days" />
        <AdminKpi title="Compliant" value={String(compliantDrivers.length)} hint="Good standing" />
      </div>

      {expiredLicenses.length > 0 && (
        <AdminRecordList rows={expiredLicenses} rowKey={(row) => row.id} loading={loading} emptyTitle="No expired licences" columns={columns('expired')} />
      )}
      {expiringSoon.length > 0 && (
        <AdminRecordList rows={expiringSoon} rowKey={(row) => row.id} loading={loading} emptyTitle="None expiring" columns={columns('soon')} />
      )}
      <AdminRecordList
        rows={compliantDrivers.slice(0, 10)}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No compliant drivers to show"
        emptyDescription={compliantDrivers.length > 10 ? `Showing 10 of ${compliantDrivers.length}` : undefined}
        columns={columns('ok')}
      />
    </>
  );
}
