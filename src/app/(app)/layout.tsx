import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import {
  accessFromMemberships,
  EMPTY_FLEET_ACCESS_SNAPSHOT,
  type FleetAccessSnapshot,
} from '@/lib/fleet-access';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';

// The role/tenant comes from the request's session, so app pages must never be
// prerendered with an empty snapshot (public env can be supplied at runtime).
export const dynamic = 'force-dynamic';

/**
 * Resolve the role/tenant on the server so the very first paint has the right
 * menu. Without this, the client provider started with role = null and briefly
 * rendered the full owner menu (and "User / Member") to a driver.
 *
 * This is a single session read + one membership query. The client provider
 * only fills in driver-scope details (driver record and assigned vehicle), and
 * re-checks the session after auth events.
 */
async function initialFleetAccess(): Promise<FleetAccessSnapshot> {
  if (!hasSupabaseEnv()) return EMPTY_FLEET_ACCESS_SNAPSHOT;

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return EMPTY_FLEET_ACCESS_SNAPSHOT;

    // Never .single(): one user can hold several active memberships.
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (membershipError) {
      console.error('Could not resolve fleet memberships:', membershipError.message);
      return EMPTY_FLEET_ACCESS_SNAPSHOT;
    }
    return accessFromMemberships(memberships, user);
  } catch (error) {
    // A network/config problem must not blank the app: the provider falls back
    // to its own load and the shell keeps its neutral skeleton meanwhile.
    console.error('Could not resolve fleet access:', error);
    return EMPTY_FLEET_ACCESS_SNAPSHOT;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const initialAccess = await initialFleetAccess();
  return <AppShell initialAccess={initialAccess}>{children}</AppShell>;
}
