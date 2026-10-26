-- 009_rls_crud_fixes.sql
--
-- Fixes the row level security problems behind the CRUD failures in the admin
-- console and in the fleet app. Apply AFTER 008_pin_reset_log.sql.
--
-- What this migration does
--   1. Re-creates the tenant helper functions (SECURITY DEFINER) so every
--      policy below can rely on them without recursing into memberships.
--   2. Closes the membership self-insert hole: a user may only become owner of
--      a tenant that has no members yet, and an admin can never mint a new
--      owner.
--   3. Removes the open "any authenticated user can insert a tenant" policy.
--      Tenants are created through public.create_tenant_with_owner()
--      (SECURITY DEFINER) or by a system admin.
--   4. Re-creates the trips SELECT / INSERT / UPDATE / DELETE policies for
--      fleet members (without owner/admin UPDATE + DELETE every edit matched
--      zero rows and the UI reported success).
--   5. Adds explicit WITH CHECK clauses to every tenant-scoped UPDATE / ALL
--      policy, so a row can never be moved into another tenant.
--   6. Gives system admins UPDATE / DELETE on profiles and full management of
--      support_messages, and gives authenticated users an INSERT path for
--      audit_logs (previously SELECT only).
--   7. Backfills one owner membership for every tenant that has none — the
--      live project has one orphan tenant created before onboarding switched
--      to create_tenant_with_owner().
--
-- Every statement is idempotent: re-running the file is safe. No GRANT is
-- changed here; 007 already granted CRUD to authenticated and 008 deliberately
-- limited pin_reset_log to SELECT.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tenant helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
    and is_active = true;
$$;

create or replace function public.has_tenant_role(tenant_uuid uuid, required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = auth.uid()
      and tenant_id = tenant_uuid
      and role = required_role
      and is_active = true
  );
$$;

create or replace function public.has_any_tenant_role(tenant_uuid uuid, required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = auth.uid()
      and tenant_id = tenant_uuid
      and role = any(required_roles)
      and is_active = true
  );
$$;

create or replace function public.tenant_has_no_members(tenant_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.memberships where tenant_id = tenant_uuid
  );
$$;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and is_active = true
  );
$$;

grant execute on function public.current_tenant_ids() to authenticated;
grant execute on function public.has_tenant_role(uuid, text) to authenticated;
grant execute on function public.has_any_tenant_role(uuid, text[]) to authenticated;
grant execute on function public.tenant_has_no_members(uuid) to authenticated;
grant execute on function public.is_system_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Memberships — no more "become owner of any tenant"
-- ---------------------------------------------------------------------------

-- 001: inline subquery policies. 002: split into view/update/delete/insert.
-- 007: "System admins manage memberships" is intentionally kept.
drop policy if exists "Users can view their memberships" on public.memberships;
drop policy if exists "Owners/Admins can manage memberships" on public.memberships;
drop policy if exists "Owners/Admins can view memberships" on public.memberships;
drop policy if exists "Owners/Admins can update memberships" on public.memberships;
drop policy if exists "Owners/Admins can delete memberships" on public.memberships;
drop policy if exists "Users can create their own membership" on public.memberships;
drop policy if exists "Members can view their memberships" on public.memberships;
drop policy if exists "Owners and admins manage memberships" on public.memberships;
drop policy if exists "New fleet owner can claim an empty tenant" on public.memberships;

-- One SELECT policy instead of the duplicated inline-subquery + helper pair.
create policy "Members can view their memberships"
  on public.memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or tenant_id in (select public.current_tenant_ids())
  );

-- Fleet owners and admins manage the roster of their own tenant only, and an
-- admin cannot promote anyone (or themselves) to owner.
create policy "Owners and admins manage memberships"
  on public.memberships for all
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']))
  with check (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin'])
    and (
      role <> 'owner'
      or public.has_tenant_role(tenant_id, 'owner')
    )
  );

-- The first owner of a brand-new tenant. tenant_has_no_members() stops anyone
-- from adding themselves to a fleet that already has members.
create policy "New fleet owner can claim an empty tenant"
  on public.memberships for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and role = 'owner'
    and public.tenant_has_no_members(tenant_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Tenants — created through the RPC, never with a bare INSERT
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can create tenant" on public.tenants;
drop policy if exists "Owners can update tenant" on public.tenants;

create policy "Owners can update tenant"
  on public.tenants for update
  to authenticated
  using (public.has_tenant_role(id, 'owner'))
  with check (public.has_tenant_role(id, 'owner'));

-- ---------------------------------------------------------------------------
-- 4. Fleet tables — explicit WITH CHECK on every write policy
-- ---------------------------------------------------------------------------

drop policy if exists "Owners/Admins can manage drivers" on public.drivers;
create policy "Owners/Admins can manage drivers"
  on public.drivers for all
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "Owners/Admins can manage vehicles" on public.vehicles;
create policy "Owners/Admins can manage vehicles"
  on public.vehicles for all
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "Owners/Admins can manage assignments" on public.driver_assignments;
create policy "Owners/Admins can manage assignments"
  on public.driver_assignments for all
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "All members can record collections" on public.collections;
create policy "All members can record collections"
  on public.collections for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "Owners/Admins/Accountants can update collections" on public.collections;
create policy "Owners/Admins/Accountants can update collections"
  on public.collections for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']));

drop policy if exists "Owners/Admins can delete collections" on public.collections;
create policy "Owners/Admins can delete collections"
  on public.collections for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "All members can record expenses" on public.expenses;
create policy "All members can record expenses"
  on public.expenses for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "Owners/Admins/Accountants can update expenses" on public.expenses;
create policy "Owners/Admins/Accountants can update expenses"
  on public.expenses for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']));

drop policy if exists "Owners/Admins can delete expenses" on public.expenses;
create policy "Owners/Admins can delete expenses"
  on public.expenses for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "All members can record maintenance" on public.maintenance_logs;
create policy "All members can record maintenance"
  on public.maintenance_logs for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "Owners/Admins can update maintenance" on public.maintenance_logs;
create policy "Owners/Admins can update maintenance"
  on public.maintenance_logs for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "Owners/Admins can delete maintenance" on public.maintenance_logs;
create policy "Owners/Admins can delete maintenance"
  on public.maintenance_logs for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- 5. Trips — full member read/write, owner/admin update and delete
-- ---------------------------------------------------------------------------

drop policy if exists "Members can view trips" on public.trips;
create policy "Members can view trips"
  on public.trips for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "Members can record trips" on public.trips;
create policy "Members can record trips"
  on public.trips for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists "Owners/Admins can update trips" on public.trips;
create policy "Owners/Admins can update trips"
  on public.trips for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

drop policy if exists "Owners/Admins can delete trips" on public.trips;
create policy "Owners/Admins can delete trips"
  on public.trips for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- 6. Profiles, support messages and audit logs
-- ---------------------------------------------------------------------------

-- Fleet users can update their own row (001). System admins could only read
-- profiles (007), so "deactivate user" / "edit user" silently changed nothing.
drop policy if exists "System admins can update profiles" on public.profiles;
create policy "System admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "System admins can delete profiles" on public.profiles;
create policy "System admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_system_admin());

-- 007 gave admins SELECT only, so replying to / closing a ticket failed.
drop policy if exists "System admins manage support messages" on public.support_messages;
create policy "System admins manage support messages"
  on public.support_messages for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- audit_logs only had a SELECT policy in 007: every client-side audit write
-- was rejected. Members may write their own entries; admins may write any.
drop policy if exists "Users can write their own audit entries" on public.audit_logs;
create policy "Users can write their own audit entries"
  on public.audit_logs for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_system_admin());

drop policy if exists "System admins manage audit logs" on public.audit_logs;
create policy "System admins manage audit logs"
  on public.audit_logs for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- ---------------------------------------------------------------------------
-- 7. One-off data fix — every tenant needs an owner membership
--
-- On the live project memberships is empty and there is one tenant with no
-- owner (created before onboarding switched to create_tenant_with_owner()).
-- Without an owner membership every tenant policy evaluates to false and all
-- fleet CRUD fails. This links each orphan tenant to the active system
-- administrator so the data is reachable; hand the fleet over later with:
--
--   update public.memberships m
--      set user_id = '<new-owner-auth-user-id>'
--    where m.tenant_id = '<tenant-id>' and m.role = 'owner';
--
-- Remove this block once the live data has been repaired.
-- ---------------------------------------------------------------------------

do $$
declare
  v_admin_user_id uuid;
  v_tenant record;
  v_fixed integer := 0;
begin
  select user_id
    into v_admin_user_id
    from public.admin_users
   where user_id is not null
     and is_active = true
   order by (email = 'admin@faidafleet.com') desc, created_at asc
   limit 1;

  if v_admin_user_id is null then
    raise notice 'No active system administrator with a linked auth user; skipping owner backfill.';
    return;
  end if;

  for v_tenant in
    select t.id, t.name
      from public.tenants t
     where not exists (
       select 1 from public.memberships m where m.tenant_id = t.id
     )
  loop
    insert into public.memberships (user_id, tenant_id, role, is_active)
    values (v_admin_user_id, v_tenant.id, 'owner', true)
    on conflict (user_id, tenant_id) do update
      set role = 'owner',
          is_active = true;
    v_fixed := v_fixed + 1;
    raise notice 'Linked orphan tenant % (%) to admin %', v_tenant.name, v_tenant.id, v_admin_user_id;
  end loop;

  raise notice 'Owner backfill complete: % tenant(s) repaired.', v_fixed;
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Verification (run manually after applying):
--
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public'
--    order by tablename, cmd, policyname;
--
--   select t.id, t.name, count(m.id) as members
--     from public.tenants t
--     left join public.memberships m on m.tenant_id = t.id
--    group by t.id, t.name;
-- ---------------------------------------------------------------------------
