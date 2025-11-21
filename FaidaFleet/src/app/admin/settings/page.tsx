'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
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
      const { data, error: err } = await supabase
        .from('system_settings')
        .select('key, value');

      if (err) throw err;

      const settingsMap = data?.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      if (settingsMap) {
        setSettings((prev) => ({ ...prev, ...settingsMap }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Save each setting
      for (const [key, value] of Object.entries(settings)) {
        await supabase
          .from('system_settings')
          .upsert(
            { key, value } as any,
            { onConflict: 'key' }
          );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Configure global system settings</p>
      </div>

      {saved && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <AlertDescription>Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      {/* M-Pesa Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>M-Pesa Integration</CardTitle>
          <CardDescription>Configure M-Pesa Daraja API credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Enter M-Pesa API Key"
              value={settings.mpesa_api_key || ''}
              onChange={(e) => setSettings({ ...settings, mpesa_api_key: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="consumer_key">Consumer Key</Label>
            <Input
              id="consumer_key"
              type="password"
              placeholder="Enter M-Pesa Consumer Key"
              value={settings.mpesa_consumer_key || ''}
              onChange={(e) => setSettings({ ...settings, mpesa_consumer_key: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Email Notifications</Label>
            <input
              type="checkbox"
              checked={settings.email_notifications || false}
              onChange={(e) => setSettings({ ...settings, email_notifications: e.target.checked })}
              className="w-5 h-5"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>SMS Notifications</Label>
            <input
              type="checkbox"
              checked={settings.sms_notifications || false}
              onChange={(e) => setSettings({ ...settings, sms_notifications: e.target.checked })}
              className="w-5 h-5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>System maintenance controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Maintenance Mode</Label>
              <p className="text-sm text-gray-500">Disable access for all users except admins</p>
            </div>
            <input
              type="checkbox"
              checked={settings.maintenance_mode || false}
              onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
              className="w-5 h-5"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">
        Save Settings
      </Button>
    </div>
  );
}
