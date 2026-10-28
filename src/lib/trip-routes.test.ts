import assert from 'node:assert/strict';
import test from 'node:test';
import { routeFields, routeLabel, rememberedRoute, routeStorageKey, validRouteDistance, missingTripRoutes, type TripRoute } from './trip-routes';

const route: TripRoute = { id: 'route-1', tenant_id: 'tenant-1', origin: 'Nairobi', destination: "Murang'a", distance_km: 85, is_active: true, sort_order: 0 };
test('preset label and editable trip fields use the route distance', () => {
  assert.equal(routeLabel(route), "Nairobi to Murang'a (85 km)");
  assert.deepEqual(routeFields(route), { startLocation: 'Nairobi', endLocation: "Murang'a", distanceKm: '85' });
  assert.deepEqual(routeFields(), { startLocation: '', endLocation: '', distanceKm: '' });
});
test('remembered routes must still exist and be active; storage is tenant/user scoped', () => {
  assert.equal(rememberedRoute([route], route.id), route);
  for (const id of [null, '', 'deleted']) assert.equal(rememberedRoute([route], id), undefined);
  assert.equal(rememberedRoute([{ ...route, is_active: false }], route.id), undefined);
  assert.notEqual(routeStorageKey('a', 'u'), routeStorageKey('b', 'u'));
  assert.notEqual(routeStorageKey('a', 'u'), routeStorageKey('a', 'v'));
});
test('route distances respect numeric(8,2) and positivity', () => {
  for (const value of ['0.01', '85', '107.25', '999999.99']) assert.equal(validRouteDistance(value), true, value);
  for (const value of ['', '0', '-1', 'Infinity', 'NaN', '1.234', '1000000', '1e2', ' ']) assert.equal(validRouteDistance(value), false, value);
});
test('only missing relation/schema cache errors trigger missing-table fallback', () => {
  assert.equal(missingTripRoutes({ code: '42P01' }), true);
  assert.equal(missingTripRoutes({ code: 'PGRST205' }), true);
  assert.equal(missingTripRoutes({ code: '42501' }), false);
  assert.equal(missingTripRoutes(null), false);
});

test('migration is rerunnable, tenant-scoped, owner-write-only and seeds only Mdimi without overwriting edits', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync('supabase/migrations/013_trip_routes.sql', 'utf8');
  assert.match(sql, /create table if not exists public\.trip_routes/i);
  assert.match(sql, /tenant_id in \(select public\.current_tenant_ids\(\)\)/i);
  assert.equal((sql.match(/public\.has_tenant_role\(tenant_id, 'owner'\)/g) || []).length, 4);
  assert.equal((sql.match(/drop policy if exists/g) || []).length, 4);
  assert.match(sql, /on conflict \(tenant_id, origin, destination\) do nothing/i);
  assert.match(sql, /mdimi_tenant constant uuid := 'a462c49a-d81f-42c9-9f20-ed74a6e9b8e4'/i);
  assert.match(sql, /if exists \(select 1 from public\.tenants where id = mdimi_tenant\) then\s+insert into public\.trip_routes/i);
  assert.equal((sql.match(/\(mdimi_tenant, '/g) || []).length, 6);
  assert.doesNotMatch(sql, /create (?:or replace )?function public\.seed_/i);
  assert.doesNotMatch(sql, /create trigger[^;]*on public\.tenants/i);
  assert.doesNotMatch(sql, /select public\.seed_default_trip_routes/i);
  assert.match(sql, /drop trigger if exists seed_trip_routes on public\.tenants/i);
  assert.match(sql, /drop function if exists public\.seed_default_trip_routes\(uuid\)/i);
  for (const [origin, destination, distance, order] of [
    ['Nairobi', "Murang''a", 85, 0], ["Murang''a", 'Nairobi', 85, 1],
    ["Murang''a", 'Kangema', 26, 2], ['Kangema', "Murang''a", 26, 3],
    ['Kangema', 'Nairobi', 107, 4], ['Nairobi', 'Kangema', 107, 5],
  ]) assert.ok(sql.includes(`(mdimi_tenant, '${origin}', '${destination}', ${distance}, ${order})`));
});
