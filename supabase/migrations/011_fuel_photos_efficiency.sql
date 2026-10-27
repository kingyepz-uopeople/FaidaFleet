-- 011_fuel_photos_efficiency.sql
-- Idempotent fuel metadata, private pump-photo storage, retention and indexes.
-- Apply through the normal Supabase migration process; this file is not applied
-- by the application or by the pull request.

-- Fuel remains an expense category: extending expenses preserves the existing
-- financial reports, tenant scoping and owner backup-entry workflow.
alter table public.expenses
  add column if not exists odometer_km numeric(12,2),
  add column if not exists litres numeric(12,3),
  add column if not exists price_per_litre numeric(12,2),
  add column if not exists pump_photo_path text,
  add column if not exists pump_photo_expires_at timestamptz,
  add column if not exists pump_photo_deleted_at timestamptz;

alter table public.tenants
  add column if not exists fuel_photo_retention_days integer not null default 90;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_fuel_measurements_nonnegative'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_fuel_measurements_nonnegative check (
        (odometer_km is null or odometer_km >= 0)
        and (litres is null or litres >= 0)
        and (price_per_litre is null or price_per_litre >= 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tenants_fuel_photo_retention_days_valid'
      and conrelid = 'public.tenants'::regclass
  ) then
    alter table public.tenants
      add constraint tenants_fuel_photo_retention_days_valid
      check (fuel_photo_retention_days between 30 and 365);
  end if;
end $$;

-- Set retention on the server at insert, including driver clients that do not
-- need to read fleet settings first. Existing fuel rows remain valid with NULLs.
create or replace function public.set_fuel_photo_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  retention_days integer;
begin
  if new.category = 'fuel'
    and new.pump_photo_path is not null
    and new.pump_photo_expires_at is null then
    select t.fuel_photo_retention_days
      into retention_days
      from public.tenants t
      where t.id = new.tenant_id;
    new.pump_photo_expires_at := now() + make_interval(days => coalesce(retention_days, 90));
  end if;
  return new;
end;
$$;

drop trigger if exists set_fuel_photo_expiry_on_insert on public.expenses;
create trigger set_fuel_photo_expiry_on_insert
  before insert on public.expenses
  for each row execute function public.set_fuel_photo_expiry();

-- Private, JPEG-only bucket. The 2MB ceiling comfortably includes the client's
-- approximately 200KB compressed upload while rejecting unexpectedly large files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fuel-pump-photos',
  'fuel-pump-photos',
  false,
  2097152,
  array['image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object names are {tenant_id}/{vehicle_id}/{uuid}.jpg. Drivers can upload only
-- to a currently assigned vehicle in their tenant. Owner/admin upload is needed
-- for optional owner backup entries. No public/anon access is granted.
drop policy if exists "Fuel pump photos tenant insert" on storage.objects;
create policy "Fuel pump photos tenant insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fuel-pump-photos'
    and array_length(storage.foldername(name), 1) = 2
    and storage.filename(name) ~ '^[0-9a-fA-F-]+\.jpg$'
    and (
      public.has_any_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner', 'admin']
      )
      or (
        ((storage.foldername(name))[1])::uuid in (select public.current_tenant_ids())
        and ((storage.foldername(name))[2])::uuid in (
          select public.current_driver_vehicle_ids(((storage.foldername(name))[1])::uuid)
        )
      )
    )
  );

-- Owner/admin can verify every pump photo in their tenant. A driver can read
-- only their own uploads, including older uploads after a vehicle reassignment.
drop policy if exists "Fuel pump photos scoped read" on storage.objects;
create policy "Fuel pump photos scoped read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fuel-pump-photos'
    and (
      public.has_any_tenant_role(
        ((storage.foldername(name))[1])::uuid,
        array['owner', 'admin']
      )
      or (
        owner_id = auth.uid()::text
        and ((storage.foldername(name))[1])::uuid in (select public.current_tenant_ids())
      )
    )
  );

-- No UPDATE/DELETE storage policies are provided to tenant users. Retention is
-- performed by the secured service-role route or the postgres pg_cron safety net.

-- Query shapes used by owner roster, analytics, driver stats and newest-first lists.
create index if not exists idx_drivers_tenant_created_at
  on public.drivers(tenant_id, created_at desc);
create index if not exists idx_assignments_current_driver_vehicle
  on public.driver_assignments(tenant_id, driver_id, vehicle_id, start_date desc)
  where is_current = true;
create index if not exists idx_collections_tenant_created_at
  on public.collections(tenant_id, created_at desc);
create index if not exists idx_collections_tenant_driver_created_at
  on public.collections(tenant_id, driver_id, created_at desc);
create index if not exists idx_trips_tenant_created_at
  on public.trips(tenant_id, created_at desc);
create index if not exists idx_trips_tenant_driver_created_at
  on public.trips(tenant_id, driver_id, created_at desc);
create index if not exists idx_expenses_tenant_created_at
  on public.expenses(tenant_id, created_at desc);
create index if not exists idx_expenses_fuel_vehicle_readings
  on public.expenses(tenant_id, vehicle_id, date, created_at)
  where category = 'fuel';
create index if not exists idx_expenses_fuel_photo_expiry
  on public.expenses(pump_photo_expires_at)
  where pump_photo_path is not null and pump_photo_deleted_at is null;

-- SQL safety net for installations that enable pg_cron. IMPORTANT: deleting
-- storage.objects does not reliably delete the underlying file. The Vercel cron
-- route runs earlier (02:00 UTC) and uses the Storage API; this 03:15 UTC job is
-- only a later metadata/object-row safety net. Enable pg_cron in Supabase before
-- applying if this schedule is wanted. Without the extension, a NOTICE is emitted
-- and the rest of the migration still succeeds.
create or replace function public.purge_expired_fuel_photos_sql()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  expired_expense record;
  purged_count integer := 0;
begin
  for expired_expense in
    select e.id, e.pump_photo_path
      from public.expenses e
      where e.category = 'fuel'
        and e.pump_photo_path is not null
        and e.pump_photo_deleted_at is null
        and e.pump_photo_expires_at is not null
        and e.pump_photo_expires_at <= now()
      for update
  loop
    delete from storage.objects o
      where o.bucket_id = 'fuel-pump-photos'
        and o.name = expired_expense.pump_photo_path;

    update public.expenses e
      set pump_photo_deleted_at = now(),
          pump_photo_path = null
      where e.id = expired_expense.id
        and e.pump_photo_deleted_at is null;
    purged_count := purged_count + 1;
  end loop;
  return purged_count;
end;
$$;

revoke all on function public.purge_expired_fuel_photos_sql() from public, anon, authenticated;
grant execute on function public.purge_expired_fuel_photos_sql() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-fuel-photos-sql') then
      perform cron.unschedule('purge-fuel-photos-sql');
    end if;
    perform cron.schedule(
      'purge-fuel-photos-sql',
      '15 3 * * *',
      'select public.purge_expired_fuel_photos_sql()'
    );
  else
    raise notice 'pg_cron is not enabled; skipping SQL photo-retention schedule. Enable pg_cron and rerun this migration if the SQL safety net is required.';
  end if;
end $$;

-- Driver editing needs no additional policy here: migration 001 already has
-- "Owners/Admins can manage drivers" FOR ALL and migration 009 scopes both its
-- USING and WITH CHECK to owner/admin of the row's tenant.
