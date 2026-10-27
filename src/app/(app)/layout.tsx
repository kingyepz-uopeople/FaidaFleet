import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import {
  accessFromMemberships,
  EMPTY_FLEET_ACCESS_SNAPSHOT,
} from '@/lib/fleet-access';
import { requestFleetAccess } from '@/lib/supabase/request-fleet-access';

// The role/tenant comes from the request's session, so app pages must never be
// prerendered with an empty snapshot (public env can be supplied at runtime).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Middleware has already verified this user and loaded their memberships for
  // its route guard. Reuse that result for the first paint; the helper performs
  // the original authenticated lookup if the middleware could not forward it.
  const { user, memberships, membershipError } = await requestFleetAccess();
  if (membershipError) console.error('Could not resolve fleet memberships:', membershipError);
  const initialAccess = membershipError
    ? EMPTY_FLEET_ACCESS_SNAPSHOT
    : accessFromMemberships(memberships, user);
  return <AppShell initialAccess={initialAccess}>{children}</AppShell>;
}
