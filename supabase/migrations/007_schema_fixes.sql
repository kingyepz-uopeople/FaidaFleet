-- Fixes for a database created from 001-006:
-- expense fines, daily totals, trip access, system-admin access,
-- and client privileges on the shared KPI view.

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('fuel', 'maintenance', 'insurance', 'license', 'parking', 'fine', 'other'));

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

drop materialized view if exists public.kpi_daily;
create materialized view public.kpi_daily as
with expense_totals as (
  select tenant_id, date, sum(amount) as total_expenses
  from public.expenses
  group by tenant_id, date
),
collection_totals as (
  select
    tenant_id,
    date,
    count(distinct vehicle_id) as active_vehicles,
    count(distinct driver_id) as active_drivers,
    sum(amount) filter (where payment_method = 'cash') as cash_total,
    sum(amount) filter (where payment_method = 'mpesa') as mpesa_total,
    sum(amount) filter (where payment_method = 'pochi') as pochi_total,
    sum(amount) as total_collections,
    count(*) filter (where reconciled = true) as reconciled_count,
    count(*) filter (where reconciled = false) as unreconciled_count
  from public.collections
  group by tenant_id, date
)
select
  coalesce(c.tenant_id, e.tenant_id) as tenant_id,
  coalesce(c.date, e.date) as date,
  coalesce(c.active_vehicles, 0) as active_vehicles,
  coalesce(c.active_drivers, 0) as active_drivers,
  c.cash_total,
  c.mpesa_total,
  c.pochi_total,
  coalesce(c.total_collections, 0) as total_collections,
  coalesce(c.reconciled_count, 0) as reconciled_count,
  coalesce(c.unreconciled_count, 0) as unreconciled_count,
  coalesce(e.total_expenses, 0) as total_expenses,
  coalesce(c.total_collections, 0) - coalesce(e.total_expenses, 0) as net_profit
from collection_totals c
full outer join expense_totals e
  on e.tenant_id = c.tenant_id and e.date = c.date;

create unique index kpi_daily_tenant_date on public.kpi_daily (tenant_id, date);

create or replace function public.refresh_kpi_daily()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.kpi_daily;
$$;

-- System administrators can operate the admin screens.
-- Fleet members keep the policies from earlier migrations.

drop policy if exists "System admins manage tenants" on public.tenants;
create policy "System admins manage tenants"
  on public.tenants for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage memberships" on public.memberships;
create policy "System admins manage memberships"
  on public.memberships for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage drivers" on public.drivers;
create policy "System admins manage drivers"
  on public.drivers for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage vehicles" on public.vehicles;
create policy "System admins manage vehicles"
  on public.vehicles for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage driver_assignments" on public.driver_assignments;
create policy "System admins manage driver_assignments"
  on public.driver_assignments for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage collections" on public.collections;
create policy "System admins manage collections"
  on public.collections for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage expenses" on public.expenses;
create policy "System admins manage expenses"
  on public.expenses for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage maintenance_logs" on public.maintenance_logs;
create policy "System admins manage maintenance_logs"
  on public.maintenance_logs for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage trips" on public.trips;
create policy "System admins manage trips"
  on public.trips for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins manage mpesa_transactions" on public.mpesa_transactions;
create policy "System admins manage mpesa_transactions"
  on public.mpesa_transactions for all to authenticated
  using (public.is_system_admin()) with check (public.is_system_admin());

drop policy if exists "System admins can view profiles" on public.profiles;
create policy "System admins can view profiles"
  on public.profiles for select
  to authenticated
  using (public.is_system_admin());

alter table public.plans enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "System admins manage plans" on public.plans;
create policy "System admins manage plans"
  on public.plans for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "Authenticated users can view active plans" on public.plans;
create policy "Authenticated users can view active plans"
  on public.plans for select
  to authenticated
  using (is_active = true or public.is_system_admin());

drop policy if exists "Members view tenant tickets" on public.support_tickets;
create policy "Members view tenant tickets"
  on public.support_tickets for select
  to authenticated
  using (tenant_id in (select public.current_tenant_ids()) or public.is_system_admin());

drop policy if exists "Members create tenant tickets" on public.support_tickets;
create policy "Members create tenant tickets"
  on public.support_tickets for insert
  to authenticated
  with check (
    tenant_id in (select public.current_tenant_ids())
    and created_by = auth.uid()
  );

drop policy if exists "System admins manage tickets" on public.support_tickets;
create policy "System admins manage tickets"
  on public.support_tickets for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "Members view ticket messages" on public.support_messages;
create policy "Members view ticket messages"
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

drop policy if exists "Members send ticket messages" on public.support_messages;
create policy "Members send ticket messages"
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

drop policy if exists "System admins manage settings" on public.system_settings;
create policy "System admins manage settings"
  on public.system_settings for all
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "System admins view audit logs" on public.audit_logs;
create policy "System admins view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_system_admin());

drop trigger if exists set_updated_at on public.plans;
create trigger set_updated_at before update on public.plans
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.admin_users;
create trigger set_updated_at before update on public.admin_users
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.support_tickets;
create trigger set_updated_at before update on public.support_tickets
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.system_settings;
create trigger set_updated_at before update on public.system_settings
  for each row execute function public.handle_updated_at();

create unique index if not exists admin_users_user_id_key
  on public.admin_users (user_id)
  where user_id is not null;

-- TRUNCATE is not covered by row level security, so replace broad grants.
revoke all on all tables in schema public from anon, authenticated, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

revoke all on table public.kpi_daily from anon, authenticated, public;
revoke all on function public.refresh_kpi_daily() from anon, authenticated, public;
