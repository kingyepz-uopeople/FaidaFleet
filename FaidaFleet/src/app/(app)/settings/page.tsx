"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch profile
    const profileResp = await supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', user.id).single();
    const profile: any = profileResp.data;
    const pErr = profileResp.error;
    if (pErr && pErr.code !== 'PGRST116') throw pErr; // allow not found

    setForm(prev => ({ ...prev, name: profile?.full_name || '', email: user.email || '' }));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update auth email if changed (note: may require re-auth or verification)
      if (form.email && form.email !== user.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: form.email });
        if (emailErr) throw emailErr;
      }

      // Update profile table
      const upsertResp = await supabase.from('profiles').upsert({ id: user.id, full_name: form.name }, { returning: 'minimal' });
      const upsertErr: any = upsertResp.error;
      if (upsertErr) throw upsertErr;

      setMessage('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) throw error;
      setMessage('Password updated successfully.');
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Manage your personal information and password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? <div>Loading…</div> : (
                <>
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" name="name" value={form.name} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} />
                    </div>
                    <CardFooter>
                      <Button type="submit">Save Changes</Button>
                    </CardFooter>
                  </form>
                  <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" name="currentPassword" type="password" value={form.currentPassword} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" name="newPassword" type="password" value={form.newPassword} onChange={handleChange} />
                    </div>
                    <CardFooter>
                      <Button type="submit">Change Password</Button>
                    </CardFooter>
                  </form>
                </>
              )}
              {error && (
                <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
              )}
              {message && (
                <Alert variant="default"><AlertDescription>{message}</AlertDescription></Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Invite and manage team members and their roles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                <Label htmlFor="invite-email">Invite by Email</Label>
                <div className="flex gap-2">
                  <Input id="invite-email" type="email" placeholder="new.member@example.com" />
                  <Button>Invite</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fleet">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Settings</CardTitle>
              <CardDescription>
                General settings for your fleet operations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fleet-name">Fleet Name</Label>
                <Input id="fleet-name" defaultValue="My Awesome Fleet" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" defaultValue="KES" disabled />
              </div>
            </CardContent>
             <CardFooter>
              <Button>Save Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
