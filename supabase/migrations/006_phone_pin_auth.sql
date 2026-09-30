-- Phone and PIN accounts for fleet owners and drivers.
-- System administrators remain email accounts recorded in admin_users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
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

alter table public.admin_users enable row level security;

drop policy if exists "System admins can view admin users" on public.admin_users;
create policy "System admins can view admin users"
  on public.admin_users for select
  to authenticated
  using (public.is_system_admin());

drop policy if exists "System admins can insert admin users" on public.admin_users;
create policy "System admins can insert admin users"
  on public.admin_users for insert
  to authenticated
  with check (public.is_system_admin());

drop policy if exists "System admins can update admin users" on public.admin_users;
create policy "System admins can update admin users"
  on public.admin_users for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

drop policy if exists "System admins can delete admin users" on public.admin_users;
create policy "System admins can delete admin users"
  on public.admin_users for delete
  to authenticated
  using (public.is_system_admin());

grant select, insert, update, delete on public.admin_users to authenticated;
grant execute on function public.is_system_admin() to authenticated;

-- Link a driver auth user to the fleet without giving fleet owners
-- permission to insert memberships for arbitrary accounts.
create or replace function public.provision_driver_login(
  p_driver_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select tenant_id into v_tenant
  from public.drivers
  where id = p_driver_id;

  if v_tenant is null then
    raise exception 'Driver not found';
  end if;

  if not exists (
    select 1
    from public.memberships
    where user_id = auth.uid()
      and tenant_id = v_tenant
      and role in ('owner', 'admin')
      and is_active = true
  ) then
    raise exception 'Not allowed';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Driver login was not created';
  end if;

  update public.drivers
  set user_id = p_user_id
  where id = p_driver_id;

  insert into public.memberships (user_id, tenant_id, role, invited_by)
  values (p_user_id, v_tenant, 'driver', auth.uid())
  on conflict (user_id, tenant_id) do update
    set role = 'driver',
        is_active = true,
        invited_by = excluded.invited_by;
end;
$$;

grant execute on function public.provision_driver_login(uuid, uuid) to authenticated;

comment on function public.provision_driver_login is
  'Attaches a phone-and-PIN driver login to a driver row and fleet membership.';
