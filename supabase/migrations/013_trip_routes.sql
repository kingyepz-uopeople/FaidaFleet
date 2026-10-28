-- Preset distances are road-distance estimates, not measured trip distances.
create table if not exists public.trip_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  origin text not null,
  destination text not null,
  distance_km numeric(8,2) not null check (distance_km > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, origin, destination)
);
create index if not exists idx_trip_routes_tenant_id on public.trip_routes(tenant_id);
alter table public.trip_routes enable row level security;

drop policy if exists "Members read trip routes" on public.trip_routes;
create policy "Members read trip routes" on public.trip_routes for select to authenticated
  using (tenant_id in (select public.current_tenant_ids()));
drop policy if exists "Owners insert trip routes" on public.trip_routes;
create policy "Owners insert trip routes" on public.trip_routes for insert to authenticated
  with check (public.has_tenant_role(tenant_id, 'owner'));
drop policy if exists "Owners update trip routes" on public.trip_routes;
create policy "Owners update trip routes" on public.trip_routes for update to authenticated
  using (public.has_tenant_role(tenant_id, 'owner'))
  with check (public.has_tenant_role(tenant_id, 'owner'));
drop policy if exists "Owners delete trip routes" on public.trip_routes;
create policy "Owners delete trip routes" on public.trip_routes for delete to authenticated
  using (public.has_tenant_role(tenant_id, 'owner'));

drop trigger if exists set_updated_at on public.trip_routes;
create trigger set_updated_at before update on public.trip_routes
  for each row execute function public.handle_updated_at();

-- Not exposed as an RPC: only migration/trigger execution may seed tenants.
create or replace function public.seed_default_trip_routes(tenant uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.trip_routes (tenant_id, origin, destination, distance_km, sort_order)
  values
    (tenant, 'Nairobi', 'Murang''a', 85, 0),
    (tenant, 'Murang''a', 'Nairobi', 85, 1),
    (tenant, 'Murang''a', 'Kangema', 26, 2),
    (tenant, 'Kangema', 'Murang''a', 26, 3),
    (tenant, 'Kangema', 'Nairobi', 107, 4),
    (tenant, 'Nairobi', 'Kangema', 107, 5)
  on conflict (tenant_id, origin, destination) do nothing;
$$;
revoke all on function public.seed_default_trip_routes(uuid) from public, anon, authenticated;

create or replace function public.seed_new_tenant_trip_routes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_default_trip_routes(new.id);
  return new;
end;
$$;
revoke all on function public.seed_new_tenant_trip_routes() from public, anon, authenticated;
drop trigger if exists seed_trip_routes on public.tenants;
create trigger seed_trip_routes after insert on public.tenants
  for each row execute function public.seed_new_tenant_trip_routes();

select public.seed_default_trip_routes(id) from public.tenants;
