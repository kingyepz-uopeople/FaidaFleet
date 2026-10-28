'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TripRoute, missingTripRoutes, validRouteDistance } from '@/lib/trip-routes';
import { assertMutationRow } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function TripRouteSettings({ tenantId }: { tenantId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState({ origin: '', destination: '', distance: '' });

  useEffect(() => {
    let cancelled = false;
    supabase.from('trip_routes').select('*').eq('tenant_id', tenantId).order('sort_order').order('origin').then(({ data, error }) => {
      if (cancelled) return;
      setUnavailable(missingTripRoutes(error));
      setError(error && !missingTripRoutes(error) ? 'Could not load trip routes. Reopen Settings to retry.' : null);
      setRoutes((data || []) as TripRoute[]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [supabase, tenantId]);

  const mutate = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await operation(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save trip routes. Check for duplicate routes and try again.');
    } finally { setBusy(false); }
  };

  const update = (route: TripRoute, patch: Partial<TripRoute>) => mutate(async () => {
    if (patch.distance_km !== undefined && !validRouteDistance(String(patch.distance_km))) throw new Error('Enter a distance above 0 with at most two decimals (maximum 999999.99 km).');
    const result = await supabase.from('trip_routes').update(patch).eq('tenant_id', tenantId).eq('id', route.id).select('id');
    assertMutationRow(result, 'Could not update route');
    setRoutes((rows) => rows.map((row) => row.id === route.id ? { ...row, ...patch } : row));
  });

  return <Card className="mt-5">
    <CardHeader>
      <CardTitle>Trip routes</CardTitle>
      <CardDescription>Presets for faster trip recording. Default road distances are estimates. Changes do not alter recorded trips.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {loading ? <p>Loading routes…</p> : unavailable ? <p className="text-sm text-muted-foreground">Trip route presets will be available after migration 013 is installed. Trips can still be recorded manually.</p> : <>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          void mutate(async () => {
            if (!draft.origin.trim() || !draft.destination.trim() || !validRouteDistance(draft.distance)) throw new Error('Enter From, To, and a positive distance with at most two decimals (maximum 999999.99 km).');
            const result = await supabase.from('trip_routes').insert({ tenant_id: tenantId, origin: draft.origin.trim(), destination: draft.destination.trim(), distance_km: Number(draft.distance) }).select('*');
            assertMutationRow(result, 'Could not add route. This route may already exist.');
            setRoutes((rows) => [...rows, ...(result.data as TripRoute[])]);
            setDraft({ origin: '', destination: '', distance: '' });
          });
        }}>
          <div className="space-y-2"><Label htmlFor="route-origin">From</Label><Input id="route-origin" className="h-12 text-base" required value={draft.origin} disabled={busy} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="route-destination">To</Label><Input id="route-destination" className="h-12 text-base" required value={draft.destination} disabled={busy} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="route-distance">Distance (km)</Label><Input id="route-distance" className="h-12 text-base" type="number" inputMode="decimal" min="0.01" max="999999.99" step="0.01" required value={draft.distance} disabled={busy} onChange={(e) => setDraft({ ...draft, distance: e.target.value })} /></div>
          <Button className="min-h-12" disabled={busy}>Add route</Button>
        </form>
        {!routes.length && <p className="text-sm text-muted-foreground">No routes yet. Add your first route above.</p>}
        <ul className="divide-y">{routes.map((route) => <li key={route.id} className="space-y-3 py-4">
          <p className="font-medium">{route.origin} to {route.destination}{!route.is_active && <span className="text-muted-foreground"> · Inactive</span>}</p>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
            event.preventDefault();
            const distance = String(new FormData(event.currentTarget).get('distance'));
            if (!validRouteDistance(distance)) { setError('Enter a positive distance with at most two decimals.'); return; }
            void update(route, { distance_km: Number(distance) });
          }}>
            <div className="space-y-2"><Label htmlFor={`distance-${route.id}`}>Distance (km)</Label><Input key={`${route.id}-${route.distance_km}`} id={`distance-${route.id}`} name="distance" type="number" inputMode="decimal" min="0.01" max="999999.99" step="0.01" required defaultValue={route.distance_km} disabled={busy} className="h-12 w-36 text-base" /></div>
            <Button variant="outline" className="min-h-12" disabled={busy}>Save distance</Button>
            <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={() => void update(route, { is_active: !route.is_active })}>{route.is_active ? 'Deactivate' : 'Activate'}</Button>
            <Button type="button" variant="outline" className="min-h-12 text-destructive" disabled={busy} onClick={() => {
              if (!window.confirm(`Delete ${route.origin} to ${route.destination}? Recorded trips will not change.`)) return;
              void mutate(async () => {
                const result = await supabase.from('trip_routes').delete().eq('tenant_id', tenantId).eq('id', route.id).select('id');
                assertMutationRow(result, 'Could not delete route');
                setRoutes((rows) => rows.filter((row) => row.id !== route.id));
              });
            }}>Delete</Button>
          </form>
        </li>)}</ul>
      </>}
    </CardContent>
  </Card>;
}
