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
import { formatDateOnly } from '@/lib/dates';

type TeamMember = {
  id: string;
  role: string;
  joined_at: string | null;
  user_id: string;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingFleet, setSavingFleet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fleetName, setFleetName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        setUserId(user.id);

        const profileResp = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (profileResp.error && profileResp.error.code !== 'PGRST116') throw profileResp.error;

        const membershipResp = await supabase
          .from('memberships')
          .select('tenant_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
        if (membershipResp.error) throw membershipResp.error;

        const membership = membershipResp.data as { tenant_id: string; role: string };
        setTenantId(membership.tenant_id);
        setRole(membership.role);

        const [tenantResp, teamResp] = await Promise.all([
          supabase.from('tenants').select('name').eq('id', membership.tenant_id).single(),
          supabase
            .from('memberships')
            .select('id, role, joined_at, user_id')
            .eq('tenant_id', membership.tenant_id)
            .eq('is_active', true)
            .order('joined_at', { ascending: true }),
        ]);
        if (tenantResp.error) throw tenantResp.error;
        if (teamResp.error) throw teamResp.error;

        setFleetName((tenantResp.data as { name: string }).name || '');
        setMembers((teamResp.data || []) as TeamMember[]);
        setForm((prev) => ({
          ...prev,
          name: profileResp.data?.full_name || '',
          email: user.email || '',
        }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load settings');
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

      if (form.email && form.email !== user.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: form.email });
        if (emailErr) throw emailErr;
      }

      const upsertResp = await supabase.from('profiles').upsert({ id: user.id, full_name: form.name });
      if (upsertResp.error) throw upsertResp.error;

      setMessage('Profile updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      if (!form.currentPassword || !form.newPassword) {
        throw new Error('Enter your current password and a new password');
      }
      if (form.newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters');
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Not authenticated');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: form.currentPassword,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error: updateError } = await supabase.auth.updateUser({ password: form.newPassword });
      if (updateError) throw updateError;
      setMessage('Password updated successfully.');
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    }
  };

  const handleSaveFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSavingFleet(true);
    try {
      if (role !== 'owner') throw new Error('Only the fleet owner can rename the fleet');
      if (!tenantId) throw new Error('No fleet found');
      const name = fleetName.trim();
      if (!name) throw new Error('Fleet name is required');

      const supabase = createClient();
      const { error: updateError } = await supabase.from('tenants').update({ name }).eq('id', tenantId);
      if (updateError) throw updateError;
      setFleetName(name);
      setMessage('Fleet name updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save fleet settings');
    } finally {
      setSavingFleet(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {message && (
        <Alert><AlertDescription>{message}</AlertDescription></Alert>
      )}
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
              <CardDescription>Manage your personal information and password.</CardDescription>
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
                    <Button type="submit">Save Changes</Button>
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
                    <Button type="submit">Change Password</Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>
                Active members of this fleet. Email invitations are not available yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div>Loading…</div> : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active members found.</p>
              ) : (
                <ul className="divide-y">
                  {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium capitalize">{member.role}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.user_id === userId ? 'You' : 'Team member'}
                          {member.joined_at ? ` · joined ${formatDateOnly(member.joined_at)}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fleet">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Settings</CardTitle>
              <CardDescription>General settings for your fleet operations.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveFleet}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fleet-name">Fleet Name</Label>
                  <Input
                    id="fleet-name"
                    value={fleetName}
                    onChange={(e) => setFleetName(e.target.value)}
                    disabled={loading || role !== 'owner'}
                  />
                  {role && role !== 'owner' && (
                    <p className="text-sm text-muted-foreground">Only the fleet owner can rename the fleet.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" defaultValue="KES" disabled />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading || savingFleet || role !== 'owner'}>
                  {savingFleet ? 'Saving...' : 'Save Settings'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
