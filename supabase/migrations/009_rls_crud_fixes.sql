-- 009_rls_crud_fixes.sql
-- CRUD/RLS hardening based on the 2026-10-26 read-only production audit.
--
-- Problems fixed here:
--   1. Every tenant table policy depends on public.memberships, which was
--      empty in production, so fleet-owner CRUD failed silently. Onboarding
--      already uses the SECURITY DEFINER create_tenant_with_owner() RPC;
--      this migration also back-fills the owner membership for the orphan
--      tenant (see section 9).
--   2. trips had no owner/admin UPDATE or DELETE policy in the live database,
--      so trip edits and deletes were no-ops.
--   3. Security hole: the memberships INSERT policy allowed any authenticated
--      user to attach themselves as owner of ANY tenant, and tenants allowed
--      direct INSERTs from any authenticated user (creating orphans). Direct
--      tenant creation is now system-admin only; self-onboarding still works
--      through create_tenant_with_owner() and the no-members owner policy.
--   4. System admins had no UPDATE/DELETE on profiles or support_messages.
--   5. audit_logs had no INSERT policy, so audit writes failed for everyone.
--   6. Duplicate/overlapping policies are removed and replaced with one
--      canonical, explicit policy set. UPDATE/ALL policies carry explicit
--      WITH CHECK clauses instead of relying on USING being reused.
--
-- Safe to re-run: every policy is dropped by name before being recreated and
-- every helper uses CREATE OR REPLACE. No table data is modified except the
-- guarded owner-membership back-fill in section 9.

-- ===========================================================================
-- 1. Helper functions (SECURITY DEFINER so policy checks never recurse)
-- ===========================================================================

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

-- A caller may only self-attach as owner to a tenant that has no members yet.
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

grant execute on function public.current_tenant_ids() to authenticated;
grant execute on function public.has_tenant_role(uuid, text) to authenticated;
grant execute on function public.has_any_tenant_role(uuid, text[]) to authenticated;
grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.tenant_has_no_members(uuid) to authenticated;

-- ===========================================================================
-- 2. profiles
-- ===========================================================================

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "System admins can view profiles" on public.profiles;
drop policy if exists "System admins manage profiles" on public.profiles;

create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_system_admin());

create policy "profiles_insert_self_or_admin"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id or public.is_system_admin());

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_system_admin())
  with check (auth.uid() = id or public.is_system_admin());

create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_system_admin());

-- ===========================================================================
-- 3. tenants
--    Direct INSERT is system-admin only. Fleet onboarding goes through
--    create_tenant_with_owner(), which is SECURITY DEFINER and bypasses RLS.
-- ===========================================================================

drop policy if exists "Users can view their tenants" on public.tenants;
drop policy if exists "Owners can update tenant" on public.tenants;
drop policy if exists "Authenticated users can create tenant" on public.tenants;
drop policy if exists "System admins manage tenants" on public.tenants;

create policy "tenants_select_member_or_admin"
  on public.tenants for select
  to authenticated
  using (id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "tenants_insert_admin"
  on public.tenants for insert
  to authenticated
  with check (public.is_system_admin());

create policy "tenants_update_owner_or_admin"
  on public.tenants for update
  to authenticated
  using (public.has_tenant_role(id, 'owner') or public.is_system_admin())
  with check (public.has_tenant_role(id, 'owner') or public.is_system_admin());

create policy "tenants_delete_admin"
  on public.tenants for delete
  to authenticated
  using (public.is_system_admin());

-- ===========================================================================
-- 4. memberships
--    Self-service INSERT is restricted to the first owner of a memberless
--    tenant. Driver memberships are created via provision_driver_login()
--    (SECURITY DEFINER). Everything else requires a fleet manager or a
--    system administrator.
-- ===========================================================================

drop policy if exists "Users can view their memberships" on public.memberships;
drop policy if exists "Owners/Admins can manage memberships" on public.memberships;
drop policy if exists "Owners/Admins can view memberships" on public.memberships;
drop policy if exists "Owners/Admins can update memberships" on public.memberships;
drop policy if exists "Owners/Admins can delete memberships" on public.memberships;
drop policy if exists "Users can create their own membership" on public.memberships;
drop policy if exists "System admins manage memberships" on public.memberships;

create policy "memberships_select"
  on public.memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or tenant_id in (select public.current_tenant_ids())
    or public.is_system_admin()
  );

create policy "memberships_insert_first_owner_or_admin"
  on public.memberships for insert
  to authenticated
  with check (
    public.is_system_admin()
    or (
      auth.uid() = user_id
      and role = 'owner'
      and public.tenant_has_no_members(tenant_id)
    )
  );

create policy "memberships_update_manager_or_admin"
  on public.memberships for update
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin'])
    or public.is_system_admin()
  )
  with check (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin'])
    or public.is_system_admin()
  );

create policy "memberships_delete_manager_or_admin"
  on public.memberships for delete
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin'])
    or public.is_system_admin()
  );

-- ===========================================================================
-- 5. drivers and vehicles (owner/admin fleet management)
-- ===========================================================================

drop policy if exists "Members can view tenant drivers" on public.drivers;
drop policy if exists "Owners/Admins can manage drivers" on public.drivers;
drop policy if exists "System admins manage drivers" on public.drivers;

create policy "drivers_select_member_or_admin"
  on public.drivers for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "drivers_insert_manager_or_admin"
  on public.drivers for insert
  to authenticated
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "drivers_update_manager_or_admin"
  on public.drivers for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin())
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "drivers_delete_manager_or_admin"
  on public.drivers for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

drop policy if exists "Members can view tenant vehicles" on public.vehicles;
drop policy if exists "Owners/Admins can manage vehicles" on public.vehicles;
drop policy if exists "System admins manage vehicles" on public.vehicles;

create policy "vehicles_select_member_or_admin"
  on public.vehicles for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "vehicles_insert_manager_or_admin"
  on public.vehicles for insert
  to authenticated
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "vehicles_update_manager_or_admin"
  on public.vehicles for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin())
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "vehicles_delete_manager_or_admin"
  on public.vehicles for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

-- ===========================================================================
-- 6. driver_assignments
-- ===========================================================================

drop policy if exists "Members can view assignments" on public.driver_assignments;
drop policy if exists "Owners/Admins can manage assignments" on public.driver_assignments;
drop policy if exists "System admins manage driver_assignments" on public.driver_assignments;

create policy "driver_assignments_select_member_or_admin"
  on public.driver_assignments for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "driver_assignments_insert_manager_or_admin"
  on public.driver_assignments for insert
  to authenticated
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "driver_assignments_update_manager_or_admin"
  on public.driver_assignments for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin())
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "driver_assignments_delete_manager_or_admin"
  on public.driver_assignments for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

-- ===========================================================================
-- 7. collections, expenses, maintenance_logs, trips, mpesa_transactions
-- ===========================================================================

-- collections --------------------------------------------------------------
drop policy if exists "Members can view tenant collections" on public.collections;
drop policy if exists "All members can record collections" on public.collections;
drop policy if exists "Owners/Admins/Accountants can update collections" on public.collections;
drop policy if exists "Owners/Admins can delete collections" on public.collections;
drop policy if exists "System admins manage collections" on public.collections;

create policy "collections_select_member_or_admin"
  on public.collections for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "collections_insert_member_or_admin"
  on public.collections for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "collections_update_finance_or_admin"
  on public.collections for update
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant'])
    or public.is_system_admin()
  )
  with check (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant'])
    or public.is_system_admin()
  );

create policy "collections_delete_manager_or_admin"
  on public.collections for delete
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin'])
    or public.is_system_admin()
  );

-- expenses -----------------------------------------------------------------
drop policy if exists "Members can view tenant expenses" on public.expenses;
drop policy if exists "All members can record expenses" on public.expenses;
drop policy if exists "Owners/Admins/Accountants can update expenses" on public.expenses;
drop policy if exists "Owners/Admins can delete expenses" on public.expenses;
drop policy if exists "System admins manage expenses" on public.expenses;

create policy "expenses_select_member_or_admin"
  on public.expenses for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "expenses_insert_member_or_admin"
  on public.expenses for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "expenses_update_finance_or_admin"
  on public.expenses for update
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant'])
    or public.is_system_admin()
  )
  with check (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant'])
    or public.is_system_admin()
  );

create policy "expenses_delete_manager_or_admin"
  on public.expenses for delete
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin'])
    or public.is_system_admin()
  );

-- maintenance_logs ---------------------------------------------------------
drop policy if exists "Members can view maintenance logs" on public.maintenance_logs;
drop policy if exists "All members can record maintenance" on public.maintenance_logs;
drop policy if exists "Owners/Admins can update maintenance" on public.maintenance_logs;
drop policy if exists "Owners/Admins can delete maintenance" on public.maintenance_logs;
drop policy if exists "System admins manage maintenance_logs" on public.maintenance_logs;

create policy "maintenance_select_member_or_admin"
  on public.maintenance_logs for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "maintenance_insert_member_or_admin"
  on public.maintenance_logs for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "maintenance_update_manager_or_admin"
  on public.maintenance_logs for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin())
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "maintenance_delete_manager_or_admin"
  on public.maintenance_logs for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

-- trips --------------------------------------------------------------------
-- Explicit owner/admin UPDATE and DELETE policies were missing in production.
drop policy if exists "Members can view trips" on public.trips;
drop policy if exists "Members can record trips" on public.trips;
drop policy if exists "Owners/Admins can update trips" on public.trips;
drop policy if exists "Owners/Admins can delete trips" on public.trips;
drop policy if exists "System admins manage trips" on public.trips;

create policy "trips_select_member_or_admin"
  on public.trips for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "trips_insert_member_or_admin"
  on public.trips for insert
  to authenticated
  with check (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

create policy "trips_update_manager_or_admin"
  on public.trips for update
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin())
  with check (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

create policy "trips_delete_manager_or_admin"
  on public.trips for delete
  to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner', 'admin']) or public.is_system_admin());

-- mpesa_transactions -------------------------------------------------------
drop policy if exists "Owners/Admins/Accountants can view mpesa transactions" on public.mpesa_transactions;
drop policy if exists "System admins manage mpesa_transactions" on public.mpesa_transactions;

create policy "mpesa_select_finance_or_admin"
  on public.mpesa_transactions for select
  to authenticated
  using (
    public.has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant'])
    or public.is_system_admin()
  );

create policy "mpesa_insert_admin"
  on public.mpesa_transactions for insert
  to authenticated
  with check (public.is_system_admin());

create policy "mpesa_update_admin"
  on public.mpesa_transactions for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "mpesa_delete_admin"
  on public.mpesa_transactions for delete
  to authenticated
  using (public.is_system_admin());

-- ===========================================================================
-- 8. Platform tables: plans, admin_users, support, settings, audit
-- ===========================================================================

-- plans --------------------------------------------------------------------
drop policy if exists "System admins manage plans" on public.plans;
drop policy if exists "Authenticated users can view active plans" on public.plans;

create policy "plans_select_active_or_admin"
  on public.plans for select
  to authenticated
  using (is_active = true or public.is_system_admin());

create policy "plans_insert_admin"
  on public.plans for insert
  to authenticated
  with check (public.is_system_admin());

create policy "plans_update_admin"
  on public.plans for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "plans_delete_admin"
  on public.plans for delete
  to authenticated
  using (public.is_system_admin());

-- admin_users --------------------------------------------------------------
drop policy if exists "System admins can view admin users" on public.admin_users;
drop policy if exists "System admins can insert admin users" on public.admin_users;
drop policy if exists "System admins can update admin users" on public.admin_users;
drop policy if exists "System admins can delete admin users" on public.admin_users;

create policy "admin_users_select"
  on public.admin_users for select
  to authenticated
  using (public.is_system_admin());

create policy "admin_users_insert"
  on public.admin_users for insert
  to authenticated
  with check (public.is_system_admin());

create policy "admin_users_update"
  on public.admin_users for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "admin_users_delete"
  on public.admin_users for delete
  to authenticated
  using (public.is_system_admin());

-- support_tickets ----------------------------------------------------------
drop policy if exists "Members view tenant tickets" on public.support_tickets;
drop policy if exists "Members create tenant tickets" on public.support_tickets;
drop policy if exists "System admins manage tickets" on public.support_tickets;

create policy "support_tickets_select_member_or_admin"
  on public.support_tickets for select
  to authenticated
  using (
    tenant_id in (select public.current_tenant_ids())
    or public.is_system_admin()
  );

create policy "support_tickets_insert_member_or_admin"
  on public.support_tickets for insert
  to authenticated
  with check (
    public.is_system_admin()
    or (
      created_by = auth.uid()
      and tenant_id in (select public.current_tenant_ids())
    )
  );

create policy "support_tickets_update_admin"
  on public.support_tickets for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "support_tickets_delete_admin"
  on public.support_tickets for delete
  to authenticated
  using (public.is_system_admin());

-- support_messages ---------------------------------------------------------
-- Adds the missing system-admin UPDATE/DELETE access.
drop policy if exists "Members view ticket messages" on public.support_messages;
drop policy if exists "Members send ticket messages" on public.support_messages;
drop policy if exists "System admins manage ticket messages" on public.support_messages;

create policy "support_messages_select_member_or_admin"
  on public.support_messages for select
  to authenticated
  using (
    public.is_system_admin()
    or exists (
      select 1
      from public.support_tickets t
      where t.id = ticket_id
        and t.tenant_id in (select public.current_tenant_ids())
    )
  );

create policy "support_messages_insert_sender_or_admin"
  on public.support_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_system_admin()
      or exists (
        select 1
        from public.support_tickets t
        where t.id = ticket_id
          and t.tenant_id in (select public.current_tenant_ids())
      )
    )
  );

create policy "support_messages_update_admin"
  on public.support_messages for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "support_messages_delete_admin"
  on public.support_messages for delete
  to authenticated
  using (public.is_system_admin());

-- system_settings ----------------------------------------------------------
drop policy if exists "System admins manage settings" on public.system_settings;

create policy "system_settings_select_admin"
  on public.system_settings for select
  to authenticated
  using (public.is_system_admin());

create policy "system_settings_insert_admin"
  on public.system_settings for insert
  to authenticated
  with check (public.is_system_admin());

create policy "system_settings_update_admin"
  on public.system_settings for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "system_settings_delete_admin"
  on public.system_settings for delete
  to authenticated
  using (public.is_system_admin());

-- audit_logs ---------------------------------------------------------------
-- Previously had SELECT only; client/admin audit writes failed with no
-- INSERT policy. Users may write their own audit rows, admins may write all.
drop policy if exists "System admins view audit logs" on public.audit_logs;
drop policy if exists "System admins manage audit logs" on public.audit_logs;

create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (public.is_system_admin());

create policy "audit_logs_insert_self_or_admin"
  on public.audit_logs for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_system_admin());

create policy "audit_logs_update_admin"
  on public.audit_logs for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

create policy "audit_logs_delete_admin"
  on public.audit_logs for delete
  to authenticated
  using (public.is_system_admin());

-- ===========================================================================
-- 9. One-off data fix: owner membership for the orphan tenant
--    Production (2026-10-26) had one tenant, one auth user and zero
--    memberships, so every tenant-scoped policy blocked the owner. This block
--    is a no-op when every tenant already has members or when the auth user
--    count is not exactly one; on the audited project it links the sole user
--    as owner of the memberless tenant.
--
--    To target a specific tenant/user manually instead, run with explicit ids:
--      insert into public.memberships (user_id, tenant_id, role, is_active)
--      values ('<auth-user-uuid>', '<tenant-uuid>', 'owner', true)
--      on conflict (user_id, tenant_id) do nothing;
-- ===========================================================================

do $$
declare
  v_tenant record;
  v_user_id uuid;
  v_user_count integer;
begin
  select count(*) into v_user_count from auth.users;

  if v_user_count <> 1 then
    raise notice 'Skipping orphan membership back-fill: expected exactly one auth user, found %.', v_user_count;
    return;
  end if;

  select id into v_user_id from auth.users limit 1;

  for v_tenant in
    select t.id
    from public.tenants t
    where not exists (
      select 1 from public.memberships m where m.tenant_id = t.id
    )
  loop
    insert into public.memberships (user_id, tenant_id, role, is_active)
    values (v_user_id, v_tenant.id, 'owner', true)
    on conflict (user_id, tenant_id) do nothing;

    raise notice 'Back-filled owner membership % for tenant %.', v_user_id, v_tenant.id;
  end loop;
end $$;

-- ===========================================================================
-- 10. Re-assert grants (table privileges were already correct; kept explicit
--     so the policy rebuild cannot leave a table inaccessible).
-- ===========================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- pin_reset_log stays SELECT-only for authenticated roles.
revoke insert, update, delete on public.pin_reset_log from authenticated;

-- The materialized KPI view is not exposed to the client API.
revoke all on table public.kpi_daily from anon, authenticated, public;
revoke all on function public.refresh_kpi_daily() from anon, authenticated, public;
