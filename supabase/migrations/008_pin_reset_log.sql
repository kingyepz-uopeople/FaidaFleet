-- PIN reset audit trail. The PIN itself is never stored; Supabase Auth keeps
-- only the password hash. Fleet members cannot read this table.

create table if not exists public.pin_reset_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null check (actor_role in ('system_admin', 'owner', 'admin')),
  target_kind text not null check (target_kind in ('driver', 'fleet_owner')),
  target_user_id uuid,
  target_driver_id uuid references public.drivers(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pin_reset_log_created_at_idx
  on public.pin_reset_log (created_at desc);

create index if not exists pin_reset_log_tenant_id_idx
  on public.pin_reset_log (tenant_id);

create index if not exists pin_reset_log_actor_user_id_idx
  on public.pin_reset_log (actor_user_id);

alter table public.pin_reset_log enable row level security;

revoke all on public.pin_reset_log from anon;
revoke all on public.pin_reset_log from authenticated;

grant select on public.pin_reset_log to authenticated;

drop policy if exists "System admins can read pin reset log" on public.pin_reset_log;
create policy "System admins can read pin reset log"
  on public.pin_reset_log
  for select
  to authenticated
  using (public.is_system_admin());

comment on table public.pin_reset_log is
  'Who reset whose PIN. Never store the PIN or password hash here.';
