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
import { accountPhone, isPhoneAccount, validatePin } from '@/lib/phone';
import { primaryMembership } from '@/lib/fleet-access';
import { useFleetAccess } from '@/components/fleet-access-provider';
import { SignOutButton } from '@/components/sign-out-button';
import { assertMutationRow } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { TripRouteSettings } from '@/components/trip-route-settings';
import { validFuelPhotoRetentionDays } from '@/lib/fuel';

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
  const [fuelPhotoRetentionDays, setFuelPhotoRetentionDays] = useState('90');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [phoneAccount, setPhoneAccount] = useState(true);
  const [phone, setPhone] = useState('');
  const [form, setForm] = useState({ name: '', currentPin: '', newPin: '', confirmPin: '' });
  const { isDriver, loading: accessLoading, refresh } = useFleetAccess();

  useEffect(() => {
    if (accessLoading) return;
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

        // Multiple active memberships are legal: read them all and pick one.
        const membershipResp = await supabase
          .from('memberships')
          .select('tenant_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true);
        if (membershipResp.error) throw membershipResp.error;

        const membership = primaryMembership(membershipResp.data || []);
        if (!membership) throw new Error('No fleet is linked to this account yet.');
        setTenantId(membership.tenant_id);
        setRole(membership.role);

        if (!isDriver) {
          const [tenantResp, teamResp] = await Promise.all([
            supabase.from('tenants').select('name, fuel_photo_retention_days').eq('id', membership.tenant_id).limit(1),
            supabase
              .from('memberships')
              .select('id, role, joined_at, user_id')
              .eq('tenant_id', membership.tenant_id)
              .eq('is_active', true)
              .order('joined_at', { ascending: true }),
          ]);
          if (tenantResp.error) throw tenantResp.error;
          if (teamResp.error) throw teamResp.error;

          const tenant = tenantResp.data?.[0] as { name: string; fuel_photo_retention_days: number | null } | undefined;
          setFleetName(tenant?.name || '');
          setFuelPhotoRetentionDays(String(tenant?.fuel_photo_retention_days ?? 90));
          setMembers((teamResp.data || []) as TeamMember[]);
        }
        setPhoneAccount(isPhoneAccount(user));
        setPhone(accountPhone(user) || '');
        setForm((prev) => ({
          ...prev,
          name: profileResp.data?.full_name || user.user_metadata?.full_name || '',
        }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [accessLoading, isDriver]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const upsertResp = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: form.name, phone: phone || null })
        .select('id');
      assertMutationRow(upsertResp, 'Could not save your profile');

      setMessage('Profile updated successfully.');
      toastSuccess('Profile updated.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save profile';
      setError(message);
      toastError(message, 'Could not save profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const pinError = validatePin(form.newPin);
      if (!form.currentPin || !form.newPin || !form.confirmPin) {
        throw new Error('Enter your current PIN, a new PIN, and confirm it');
      }
      if (pinError) throw new Error(pinError);
      if (form.newPin !== form.confirmPin) throw new Error('PINs do not match');
      if (!phoneAccount) {
        throw new Error('PIN changes are for phone accounts');
      }

      // Server route transforms both PINs with the shared helper and verifies
      // the current one. No browser updateUser() call with a raw PIN.
      const response = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: form.currentPin,
          newPin: form.newPin,
          confirmPin: form.confirmPin,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not change PIN');
      setMessage('PIN updated successfully. Use your new PIN next time you sign in.');
      setForm((prev) => ({ ...prev, currentPin: '', newPin: '', confirmPin: '' }));
      await refresh();
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
      if (isDriver) throw new Error('Drivers cannot change fleet settings');
      if (role !== 'owner') throw new Error('Only the fleet owner can rename the fleet');
      if (!tenantId) throw new Error('No fleet found');
      const name = fleetName.trim();
      if (!name) throw new Error('Fleet name is required');
      const retentionDays = Number(fuelPhotoRetentionDays);
      if (!validFuelPhotoRetentionDays(retentionDays)) {
        throw new Error('Keep fuel photos for a whole number of days from 30 to 365');
      }

      const supabase = createClient();
      const updateResult = await supabase
        .from('tenants')
        .update({ name, fuel_photo_retention_days: retentionDays })
        .eq('id', tenantId)
        .select('id');
      assertMutationRow(updateResult, 'Could not rename the fleet');
      setFleetName(name);
      setFuelPhotoRetentionDays(String(retentionDays));
      setMessage('Fleet settings updated. The new photo retention applies to new fuel entries.');
      toastSuccess('Fleet settings updated.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save fleet settings';
      setError(message);
      toastError(message, 'Could not save fleet settings');
    } finally {
      setSavingFleet(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {message && (
        <Alert><AlertDescription>{message}</AlertDescription></Alert>
      )}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={cn('grid h-auto w-full', isDriver ? 'grid-cols-1' : 'grid-cols-3')}>
          <TabsTrigger value="profile" className="min-h-11">Profile</TabsTrigger>
          {!isDriver && <TabsTrigger value="team" className="min-h-11">Team</TabsTrigger>}
          {!isDriver && <TabsTrigger value="fleet" className="min-h-11">Fleet</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your name and PIN. Sign-in uses your phone number. If you forget your PIN, ask a system administrator to reset it.</CardDescription>
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
                      <Label htmlFor="phone">Phone number</Label>
                      <Input id="phone" value={phone} readOnly />
                      <p className="text-sm text-muted-foreground">This phone number is used to sign in. It is not an email address.</p>
                    </div>
                    <Button type="submit" className="min-h-11">Save Changes</Button>
                  </form>
                  {phoneAccount && (
                  <form onSubmit={handleChangePassword} className="mt-6 space-y-4 rounded-2xl border bg-muted/40 p-4">
                    <div>
                      <h2 className="font-semibold">Change PIN</h2>
                      <p className="text-sm text-muted-foreground">Enter your current PIN, then a new 4 to 6 digit PIN. Forgotten PIN? Ask a system administrator.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentPin">Current PIN</Label>
                      <Input id="currentPin" name="currentPin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} className="h-12 text-base" value={form.currentPin} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPin">New PIN</Label>
                      <Input id="newPin" name="newPin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className="h-12 text-base" value={form.newPin} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPin">Confirm new PIN</Label>
                      <Input id="confirmPin" name="confirmPin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className="h-12 text-base" value={form.confirmPin} onChange={handleChange} />
                    </div>
                    <Button type="submit" className="min-h-11 w-full sm:w-auto">Change PIN</Button>
                  </form>
                  )}
                  <SignOutButton
                    label="Sign out"
                    className="w-full justify-center rounded-xl border border-input px-4 text-sm font-medium hover:bg-muted sm:w-auto"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {!isDriver && <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>
                Active members of this fleet. Drivers sign in with the phone number and PIN set when they are added.
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
        </TabsContent>}
        {!isDriver && <TabsContent value="fleet">
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
                  <Label htmlFor="fuel-photo-retention">Keep fuel photos for N days</Label>
                  <Input
                    id="fuel-photo-retention"
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={365}
                    step={1}
                    className="min-h-11"
                    value={fuelPhotoRetentionDays}
                    onChange={(event) => setFuelPhotoRetentionDays(event.target.value)}
                    disabled={loading || role !== 'owner'}
                    required
                  />
                  <p className="text-sm text-muted-foreground">Choose 30–365 days. The default is 90 days; changes apply to new fuel photos.</p>
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
          {!loading && role === 'owner' && tenantId && <TripRouteSettings key={tenantId} tenantId={tenantId} />}
        </TabsContent>}
      </Tabs>
    </div>
  );
}
