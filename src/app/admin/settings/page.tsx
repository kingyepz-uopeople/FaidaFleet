'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { AdminLoading, AdminPageHeader } from '@/components/admin-ui';
import { isAdminUiPreview } from '@/lib/admin-preview';
import { saveSystemSettings } from './actions';
import { useToast } from '@/hooks/use-toast';

type SettingsState = {
  mpesa_api_key: string;
  mpesa_consumer_key: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  maintenance_mode: boolean;
};

const EMPTY_SETTINGS: SettingsState = {
  mpesa_api_key: '',
  mpesa_consumer_key: '',
  email_notifications: true,
  sms_notifications: false,
  maintenance_mode: false,
};

export default function SettingsPage() {
  const preview = isAdminUiPreview();
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(EMPTY_SETTINGS);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    void fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      if (preview) return;
      const { data, error: err } = await supabase
        .from('system_settings')
        .select('key, value');

      if (err) throw err;

      const settingsMap = data?.reduce<Record<string, unknown>>((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      if (settingsMap) {
        setSettings((prev) => ({
          ...prev,
          mpesa_api_key: typeof settingsMap.mpesa_api_key === 'string' ? settingsMap.mpesa_api_key : '',
          mpesa_consumer_key: typeof settingsMap.mpesa_consumer_key === 'string' ? settingsMap.mpesa_consumer_key : '',
          email_notifications: settingsMap.email_notifications !== false,
          sms_notifications: settingsMap.sms_notifications === true,
          maintenance_mode: settingsMap.maintenance_mode === true,
        }));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (preview) {
        toast({ title: 'Preview mode', description: 'Settings are not saved in the UI preview.' });
        return;
      }
      const result = await saveSystemSettings(
        Object.entries(settings).map(([key, value]) => ({ key, value })),
      );
      if (!result.success) {
        throw new Error(result.error || 'Could not save settings.');
      }
      toast({ title: 'Settings saved', description: `${result.saved ?? 0} setting${result.saved === 1 ? '' : 's'} updated.` });
    } catch (error) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
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
      {loadError && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>M-Pesa</CardTitle>
          <CardDescription>Daraja API credentials — saved server-side, never exposed to the browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_key">API key</Label>
            <Input
              id="api_key"
              type="password"
              autoComplete="off"
              placeholder="Enter M-Pesa API key"
              value={settings.mpesa_api_key}
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
              value={settings.mpesa_consumer_key}
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
              checked={settings.email_notifications}
              onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
            />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-4">
            <Label htmlFor="sms_notifications">SMS notifications</Label>
            <Switch
              id="sms_notifications"
              checked={settings.sms_notifications}
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
              checked={settings.maintenance_mode}
              onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </>
  );
}
