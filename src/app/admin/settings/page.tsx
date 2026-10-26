'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import { assertMutation } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { AdminFeedback, AdminLoading, AdminPageHeader } from '@/components/admin-ui';
import { isAdminUiPreview } from '@/lib/admin-preview';

export default function SettingsPage() {
  const [loading, setLoading] = useState(!isAdminUiPreview());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    mpesa_api_key: '',
    mpesa_consumer_key: '',
    email_notifications: true,
    sms_notifications: false,
    maintenance_mode: false,
  });
  const supabase = createClient();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      if (isAdminUiPreview()) {
        return;
      }
      const { data, error: err } = await supabase
        .from('system_settings')
        .select('key, value');

      if (err) throw err;

      const settingsMap = data?.reduce((acc: Record<string, unknown>, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      if (settingsMap) {
        setSettings((prev) => ({ ...prev, ...settingsMap }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load settings';
      setError(message);
      toastError(message, 'Could not load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isAdminUiPreview()) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        return;
      }
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        // .select() is required: a row level security denial on upsert returns
        // no error, only zero rows.
        const result = await supabase
          .from('system_settings')
          .upsert({ key, value }, { onConflict: 'key' })
          .select('key');
        assertMutation(result, `Could not save "${key}"`);
      }
      setSaved(true);
      toastSuccess('Settings saved.');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save settings';
      setError(message);
      toastError(message, 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <AdminPageHeader title="Settings" description="Global platform configuration." />
        <AdminLoading />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Settings" description="Global platform configuration. These controls are for system administrators only." />
      <AdminFeedback error={error} success={saved ? 'Settings saved.' : null} />

      <Card>
        <CardHeader>
          <CardTitle>M-Pesa</CardTitle>
          <CardDescription>Daraja API credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_key">API key</Label>
            <Input
              id="api_key"
              type="password"
              autoComplete="off"
              placeholder="Enter M-Pesa API key"
              value={settings.mpesa_api_key || ''}
              onChange={(e) => setSettings({ ...settings, mpesa_api_key: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumer_key">Consumer key</Label>
            <Input
              id="consumer_key"
              type="password"
              autoComplete="off"
              placeholder="Enter M-Pesa consumer key"
              value={settings.mpesa_consumer_key || ''}
              onChange={(e) => setSettings({ ...settings, mpesa_consumer_key: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>How the platform emails or texts operators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-11 items-center justify-between gap-4">
            <Label htmlFor="email_notifications">Email notifications</Label>
            <Switch
              id="email_notifications"
              checked={Boolean(settings.email_notifications)}
              onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
            />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-4">
            <Label htmlFor="sms_notifications">SMS notifications</Label>
            <Switch
              id="sms_notifications"
              checked={Boolean(settings.sms_notifications)}
              onCheckedChange={(checked) => setSettings({ ...settings, sms_notifications: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>Take the operator app offline while keeping admin access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-11 items-center justify-between gap-4">
            <div>
              <Label htmlFor="maintenance_mode">Maintenance mode</Label>
              <p className="text-sm text-muted-foreground">Disable access for all users except admins</p>
            </div>
            <Switch
              id="maintenance_mode"
              checked={Boolean(settings.maintenance_mode)}
              onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="button" className="min-h-11" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </>
  );
}
