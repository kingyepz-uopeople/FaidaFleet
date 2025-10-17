-- FaidaFleet Database Schema
-- Complete multi-tenant fleet management system with Supabase Auth

-- ============================================
-- 1. ENABLE EXTENSIONS
-- ============================================
create extension if not exists "uuid-ossp";

-- ============================================
-- 2. CORE TENANCY TABLES
-- ============================================

-- Tenants (Fleet Companies)
create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business_name text,
  phone text,
  email text,
  plan text default 'starter' check (plan in ('starter', 'pro', 'enterprise')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Memberships (User-Tenant Relationship with Roles)
create table public.memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'accountant', 'driver')),
  is_active boolean default true,
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique(user_id, tenant_id)
);

-- ============================================
-- 3. FLEET MANAGEMENT TABLES
-- ============================================

-- Drivers
create table public.drivers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  license_number text,
  license_expiry date,
  id_number text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, phone)
);

-- Vehicles
create table public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  registration_number text not null,
  make text,
  model text,
  year integer,
  capacity integer,
  route text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, registration_number)
);

-- Driver Assignments (Track driver-vehicle history)
create table public.driver_assignments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  start_date date not null,
  end_date date,
  is_current boolean default true,
  notes text,
  created_at timestamptz default now(),
  check (end_date is null or end_date >= start_date)
);

-- ============================================
-- 4. FINANCIAL TRACKING TABLES
-- ============================================

-- Collections (Daily Revenue)
create table public.collections (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  date date not null default current_date,
  shift text check (shift in ('morning', 'afternoon', 'evening', 'night')),
  amount numeric(10,2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'mpesa', 'pochi')),
  mpesa_receipt text,
  reconciled boolean default false,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id),
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- M-Pesa Transactions (Daraja Webhook Data)
create table public.mpesa_transactions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transaction_type text not null,
  trans_id text unique not null,
  trans_time timestamptz not null,
  trans_amount numeric(10,2) not null,
  business_short_code text,
  bill_ref_number text,
  msisdn text,
  first_name text,
  last_name text,
  org_account_balance numeric(10,2),
  third_party_trans_id text,
  phone_number text,
  matched_collection_id uuid references public.collections(id),
  raw_data jsonb,
  created_at timestamptz default now()
);

-- Expenses
create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  date date not null default current_date,
  category text not null check (category in ('fuel', 'maintenance', 'insurance', 'license', 'parking', 'other')),
  amount numeric(10,2) not null check (amount >= 0),
  description text,
  receipt_url text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Maintenance Logs
create table public.maintenance_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('service', 'repair', 'inspection', 'other')),
  description text not null,
  cost numeric(10,2) check (cost >= 0),
  odometer_reading integer,
  next_service_date date,
  garage_name text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 5. HELPER FUNCTION FOR RLS
-- ============================================

-- Get all tenant IDs the current user belongs to
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
    and is_active = true;
$$;

-- Check if user has specific role in tenant
create or replace function public.has_tenant_role(tenant_uuid uuid, required_role text)
returns boolean
language sql
stable
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

-- Check if user has any of the specified roles in tenant
create or replace function public.has_any_tenant_role(tenant_uuid uuid, required_roles text[])
returns boolean
language sql
stable
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

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_assignments enable row level security;
alter table public.collections enable row level security;
alter table public.mpesa_transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.maintenance_logs enable row level security;

-- Profiles Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Tenants Policies
create policy "Users can view their tenants"
  on public.tenants for select
  using (id in (select current_tenant_ids()));

create policy "Owners can update tenant"
  on public.tenants for update
  using (has_tenant_role(id, 'owner'));

create policy "Authenticated users can create tenant"
  on public.tenants for insert
  with check (auth.uid() is not null);

-- Memberships Policies
create policy "Users can view their memberships"
  on public.memberships for select
  using (user_id = auth.uid() or tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins can manage memberships"
  on public.memberships for all
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- Drivers Policies
create policy "Members can view tenant drivers"
  on public.drivers for select
  using (tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins can manage drivers"
  on public.drivers for all
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- Vehicles Policies
create policy "Members can view tenant vehicles"
  on public.vehicles for select
  using (tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins can manage vehicles"
  on public.vehicles for all
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- Driver Assignments Policies
create policy "Members can view assignments"
  on public.driver_assignments for select
  using (tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins can manage assignments"
  on public.driver_assignments for all
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- Collections Policies
create policy "Members can view tenant collections"
  on public.collections for select
  using (tenant_id in (select current_tenant_ids()));

create policy "All members can record collections"
  on public.collections for insert
  with check (tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins/Accountants can update collections"
  on public.collections for update
  using (has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']));

create policy "Owners/Admins can delete collections"
  on public.collections for delete
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- M-Pesa Transactions Policies
create policy "Owners/Admins/Accountants can view mpesa transactions"
  on public.mpesa_transactions for select
  using (has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']));

-- Expenses Policies
create policy "Members can view tenant expenses"
  on public.expenses for select
  using (tenant_id in (select current_tenant_ids()));

create policy "All members can record expenses"
  on public.expenses for insert
  with check (tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins/Accountants can update expenses"
  on public.expenses for update
  using (has_any_tenant_role(tenant_id, array['owner', 'admin', 'accountant']));

create policy "Owners/Admins can delete expenses"
  on public.expenses for delete
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- Maintenance Logs Policies
create policy "Members can view maintenance logs"
  on public.maintenance_logs for select
  using (tenant_id in (select current_tenant_ids()));

create policy "All members can record maintenance"
  on public.maintenance_logs for insert
  with check (tenant_id in (select current_tenant_ids()));

create policy "Owners/Admins can update maintenance"
  on public.maintenance_logs for update
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

create policy "Owners/Admins can delete maintenance"
  on public.maintenance_logs for delete
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

create index idx_memberships_user_id on public.memberships(user_id);
create index idx_memberships_tenant_id on public.memberships(tenant_id);
create index idx_drivers_tenant_id on public.drivers(tenant_id);
create index idx_vehicles_tenant_id on public.vehicles(tenant_id);
create index idx_driver_assignments_tenant_id on public.driver_assignments(tenant_id);
create index idx_driver_assignments_current on public.driver_assignments(tenant_id, is_current) where is_current = true;
create index idx_collections_tenant_date on public.collections(tenant_id, date desc);
create index idx_collections_reconciled on public.collections(tenant_id, reconciled) where reconciled = false;
create index idx_mpesa_trans_id on public.mpesa_transactions(trans_id);
create index idx_mpesa_tenant_time on public.mpesa_transactions(tenant_id, trans_time desc);
create index idx_expenses_tenant_date on public.expenses(tenant_id, date desc);
create index idx_maintenance_tenant_date on public.maintenance_logs(tenant_id, date desc);

-- ============================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ============================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.tenants
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.drivers
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.vehicles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.collections
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.expenses
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.maintenance_logs
  for each row execute function public.handle_updated_at();

-- ============================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 10. MATERIALIZED VIEW FOR DASHBOARD KPIs
-- ============================================

create materialized view public.kpi_daily as
select
  c.tenant_id,
  c.date,
  count(distinct c.vehicle_id) as active_vehicles,
  count(distinct c.driver_id) as active_drivers,
  sum(c.amount) filter (where c.payment_method = 'cash') as cash_total,
  sum(c.amount) filter (where c.payment_method = 'mpesa') as mpesa_total,
  sum(c.amount) filter (where c.payment_method = 'pochi') as pochi_total,
  sum(c.amount) as total_collections,
  count(*) filter (where c.reconciled = true) as reconciled_count,
  count(*) filter (where c.reconciled = false) as unreconciled_count,
  coalesce(sum(e.amount), 0) as total_expenses,
  sum(c.amount) - coalesce(sum(e.amount), 0) as net_profit
from public.collections c
left join public.expenses e on e.tenant_id = c.tenant_id and e.date = c.date
group by c.tenant_id, c.date;

-- Create index on materialized view
create unique index on public.kpi_daily (tenant_id, date);

-- Function to refresh KPI view
create or replace function public.refresh_kpi_daily()
returns void
language sql
security definer
as $$
  refresh materialized view concurrently public.kpi_daily;
$$;

-- ============================================
-- 11. GRANT PERMISSIONS
-- ============================================

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
