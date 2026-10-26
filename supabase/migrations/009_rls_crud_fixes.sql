-- 009_rls_crud_fixes.sql  (applied live 2026-10-26; re-runnable: drop policy if exists before each create)
-- Based on read-only audit of live project wjoyuodxqpyfdzssvado on 2026-10-26.
-- All writes stay scoped to tenant membership (owner/admin[/accountant]) or is_system_admin().


-- 1) trips: owners/admins have NO UPDATE and NO DELETE policy -> edits/deletes silently affect 0 rows.
drop policy if exists "Owners/Admins can update trips" on public.trips;
create policy "Owners/Admins can update trips" on public.trips
  for update to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner','admin','accountant']))
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin','accountant']));
drop policy if exists "Owners/Admins can delete trips" on public.trips;
create policy "Owners/Admins can delete trips" on public.trips
  for delete to authenticated
  using (public.has_any_tenant_role(tenant_id, array['owner','admin']));

-- 2) Add explicit WITH CHECK to UPDATE/ALL policies (Postgres falls back to USING, so this is
--    hardening, not a functional fix) and stop owners moving rows into another tenant.
alter policy "Owners/Admins can manage vehicles" on public.vehicles
  using (public.has_any_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin']));
alter policy "Owners/Admins can manage drivers" on public.drivers
  using (public.has_any_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin']));
alter policy "Owners/Admins can manage assignments" on public.driver_assignments
  using (public.has_any_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin']));
alter policy "Owners/Admins/Accountants can update collections" on public.collections
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin','accountant']));
alter policy "Owners/Admins/Accountants can update expenses" on public.expenses
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin','accountant']));
alter policy "Owners/Admins can update maintenance" on public.maintenance_logs
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin']));
alter policy "Owners/Admins can update memberships" on public.memberships
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin']));
alter policy "Owners can update tenant" on public.tenants
  with check (public.has_tenant_role(id, 'owner'));
alter policy "Users can update own profile" on public.profiles with check (auth.uid() = id);

-- 3) Remove duplicate policies (inline memberships subqueries duplicating helper-based ones).
--    Not recursive today (they live on other tables and helpers are SECURITY DEFINER), but they
--    double the evaluation cost and confuse audits.
drop policy if exists "Admins can manage vehicles" on public.vehicles;
drop policy if exists "Users can view tenant vehicles" on public.vehicles;
drop policy if exists "Admins can manage drivers" on public.drivers;
drop policy if exists "Users can view tenant drivers" on public.drivers;
drop policy if exists "Users can view assignments" on public.driver_assignments;
drop policy if exists "Users can view collections" on public.collections;
drop policy if exists "Users can view expenses" on public.expenses;
drop policy if exists "Users can view maintenance" on public.maintenance_logs;
drop policy if exists "Users can view their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
-- "All members can record X" lets drivers insert collections/expenses/maintenance; keep only if
-- intended. If drivers must not record, drop these and keep the "Team can record X" ones:
-- drop policy if exists "All members can record collections" on public.collections;
-- drop policy if exists "All members can record expenses" on public.expenses;
-- drop policy if exists "All members can record maintenance" on public.maintenance_logs;

-- 4) Tenant creation: "Authenticated users can create tenant" allows insert, but the creator is not yet
--    a member, so insert(...).select() returns nothing/fails. Live has 1 tenant with 0 memberships
--    (orphan). Require the app to use create_tenant_with_owner() RPC; restrict direct inserts:
drop policy if exists "Authenticated users can create tenant" on public.tenants;
-- (system admins keep insert via "System admins manage tenants"; owners use the SECURITY DEFINER RPC.)

-- 5) Memberships: "Users can create their own membership" lets ANY user insert themselves as
--    owner of ANY tenant (privilege escalation). Replace with: only owners/admins of the tenant.
drop policy if exists "Users can create their own membership" on public.memberships;
drop policy if exists "Owners/Admins can add memberships" on public.memberships;
create policy "Owners/Admins can add memberships" on public.memberships
  for insert to authenticated
  with check (public.has_any_tenant_role(tenant_id, array['owner','admin']));

-- 6) System-admin write gaps
drop policy if exists "System admins manage profiles" on public.profiles;
create policy "System admins manage profiles" on public.profiles
  for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());
drop policy if exists "System admins manage support messages" on public.support_messages;
create policy "System admins manage support messages" on public.support_messages
  for all to authenticated using (public.is_system_admin()) with check (public.is_system_admin());
-- audit_logs: only SELECT exists; app inserts as a user fail. Allow users to log their own actions:
drop policy if exists "Users insert own audit logs" on public.audit_logs;
create policy "Users insert own audit logs" on public.audit_logs
  for insert to authenticated with check (user_id = auth.uid());
-- support_tickets: tenant members cannot update their own tickets (e.g. close). Optional:
drop policy if exists "Members update tenant tickets" on public.support_tickets;
create policy "Members update tenant tickets" on public.support_tickets
  for update to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- 7) Change roles {public} -> {authenticated} is cosmetic (anon has no grants); skipped.
