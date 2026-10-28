-- 014_full_tank_fuel.sql
-- Mark full-tank fuel fills for interval-based consumption analytics.
-- This migration is intentionally not applied by the application or this PR.
alter table public.expenses
  add column if not exists full_tank boolean not null default false;

create index if not exists idx_expenses_full_tank_tenant_date
  on public.expenses(tenant_id, date, vehicle_id)
  where category = 'fuel' and full_tank = true;
