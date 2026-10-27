-- 010_driver_scoped_rls.sql  (NOT applied here; run after 009_rls_crud_fixes.sql)
-- Re-runnable: every policy is dropped before it is created, and the small
-- SECURITY DEFINER helpers use CREATE OR REPLACE.
--
-- Goal: a memberships.role = 'driver' account may record its OWN trips,
-- collections, expenses (including fuel) and maintenance for its current
-- vehicle, and may read only those own rows. owner/admin/accountant (and the
-- existing system-admin FOR ALL policies) keep full tenant access. Every
-- branch is still tied to the caller's own tenant ids, so tenants stay
-- isolated.

-- Helpers -------------------------------------------------------------------
-- SECURITY DEFINER avoids RLS recursion when policies read drivers / assignments.
create or replace function public.current_driver_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.drivers d
  where d.user_id = auth.uid()
$$;

create or replace function public.current_driver_vehicle_ids(tenant_uuid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.vehicle_id
  from public.driver_assignments a
  where a.is_current = true
    and a.tenant_id = tenant_uuid
    and a.driver_id in (select public.current_driver_ids())
$$;

grant execute on function public.current_driver_ids() to authenticated;
grant execute on function public.current_driver_vehicle_ids(uuid) to authenticated;

-- Trips ---------------------------------------------------------------------
-- The old "Members can record trips" let ANY tenant member (including a
-- driver) insert a trip for any other driver. Recruit it for non-drivers only.
drop policy if exists "Members can record trips" on public.trips;
create policy "Members can record trips" on public.trips
  for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      not public.has_tenant_role(tenant_id, 'driver')
      or public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
    )
  );

drop policy if exists "Drivers can record own trips" on public.trips;
create policy "Drivers can record own trips" on public.trips
  for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and driver_id in (select id from public.drivers where user_id = auth.uid())
  );

drop policy if exists "Users can view trips" on public.trips;
drop policy if exists "Members can view trips" on public.trips;
create policy "Members can view trips" on public.trips
  for select to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
    or (
      tenant_id in (select public.current_tenant_ids())
      and not public.has_tenant_role(tenant_id, 'driver')
    )
    or (
      public.has_tenant_role(tenant_id, 'driver')
      and tenant_id in (select public.current_tenant_ids())
      and (
        driver_id in (select public.current_driver_ids())
        or recorded_by = auth.uid()
      )
    )
  );

-- Collections ---------------------------------------------------------------
-- Driver inserts must name their own driver row AND their current vehicle.
drop policy if exists "All members can record collections" on public.collections;
create policy "All members can record collections" on public.collections
  for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      not public.has_tenant_role(tenant_id, 'driver')
      or public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
      or (
        driver_id in (select id from public.drivers where user_id = auth.uid())
        and vehicle_id in (select public.current_driver_vehicle_ids(tenant_id))
      )
    )
  );

drop policy if exists "Members can view tenant collections" on public.collections;
create policy "Members can view tenant collections" on public.collections
  for select to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
    or (
      tenant_id in (select public.current_tenant_ids())
      and not public.has_tenant_role(tenant_id, 'driver')
    )
    or (
      public.has_tenant_role(tenant_id, 'driver')
      and tenant_id in (select public.current_tenant_ids())
      and (
        driver_id in (select public.current_driver_ids())
        or recorded_by = auth.uid()
      )
    )
  );

-- Expenses (fuel is a category here) ----------------------------------------
-- No driver_id column, so driver inserts / reads are tied to the current
-- assignment's vehicle (or to rows they recorded themselves).
drop policy if exists "All members can record expenses" on public.expenses;
create policy "All members can record expenses" on public.expenses
  for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      not public.has_tenant_role(tenant_id, 'driver')
      or public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
      or vehicle_id in (select public.current_driver_vehicle_ids(tenant_id))
    )
  );

drop policy if exists "Members can view tenant expenses" on public.expenses;
create policy "Members can view tenant expenses" on public.expenses
  for select to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
    or (
      tenant_id in (select public.current_tenant_ids())
      and not public.has_tenant_role(tenant_id, 'driver')
    )
    or (
      public.has_tenant_role(tenant_id, 'driver')
      and tenant_id in (select public.current_tenant_ids())
      and (
        vehicle_id in (select public.current_driver_vehicle_ids(tenant_id))
        or recorded_by = auth.uid()
      )
    )
  );

-- Maintenance ---------------------------------------------------------------
drop policy if exists "All members can record maintenance" on public.maintenance_logs;
create policy "All members can record maintenance" on public.maintenance_logs
  for insert to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and (
      not public.has_tenant_role(tenant_id, 'driver')
      or public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
      or vehicle_id in (select public.current_driver_vehicle_ids(tenant_id))
    )
  );

drop policy if exists "Members can view maintenance logs" on public.maintenance_logs;
create policy "Members can view maintenance logs" on public.maintenance_logs
  for select to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
    or (
      tenant_id in (select public.current_tenant_ids())
      and not public.has_tenant_role(tenant_id, 'driver')
    )
    or (
      public.has_tenant_role(tenant_id, 'driver')
      and tenant_id in (select public.current_tenant_ids())
      and (
        vehicle_id in (select public.current_driver_vehicle_ids(tenant_id))
        or recorded_by = auth.uid()
      )
    )
  );
