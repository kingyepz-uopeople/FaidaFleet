-- FaidaFleet Admin System Tables
-- Plans, Admin Users, Support Tickets, Settings

-- ============================================
-- 1. PLANS TABLE
-- ============================================
create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  price numeric(10,2) not null default 0,
  description text,
  max_vehicles integer not null default 10,
  max_drivers integer not null default 15,
  features text[] default array[]::text[],
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. ADMIN USERS TABLE
-- ============================================
create table public.admin_users (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('super_admin', 'admin', 'moderator')),
  permissions text[] default array[]::text[],
  is_active boolean default true,
  last_login timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 3. SUPPORT TICKETS TABLE
-- ============================================
create table public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('open', 'pending', 'resolved', 'closed')) default 'open',
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  assigned_to uuid references public.admin_users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 4. SUPPORT TICKET MESSAGES TABLE
-- ============================================
create table public.support_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- ============================================
-- 5. SYSTEM SETTINGS TABLE
-- ============================================
create table public.system_settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique,
  value jsonb,
  description text,
  category text default 'general',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 6. AUDIT LOG TABLE
-- ============================================
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  changes jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- ============================================
-- 7. INDEXES
-- ============================================
create index idx_plans_is_active on public.plans(is_active);
create index idx_admin_users_email on public.admin_users(email);
create index idx_admin_users_is_active on public.admin_users(is_active);
create index idx_support_tickets_tenant on public.support_tickets(tenant_id);
create index idx_support_tickets_status on public.support_tickets(status);
create index idx_support_messages_ticket on public.support_messages(ticket_id);
create index idx_system_settings_key on public.system_settings(key);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- ============================================
-- 8. INSERT DEFAULT DATA
-- ============================================
insert into public.plans (name, price, description, max_vehicles, max_drivers, features) values
  ('Starter', 0, 'Perfect for small operations', 10, 15, array['Basic dashboard', 'Driver management', 'Vehicle tracking']),
  ('Pro', 99, 'For growing fleets', 100, 150, array['Advanced analytics', 'Real-time tracking', 'Expense management', 'M-Pesa integration']),
  ('Enterprise', 299, 'For large operations', 1000, 5000, array['Custom integrations', 'Priority support', 'API access', 'White-label options'])
on conflict (name) do nothing;
