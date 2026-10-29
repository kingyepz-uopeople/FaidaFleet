-- Apply after 015 and the reserved 016. Safe to re-run; does not alter PINs.
-- All DDL and legacy flag migration succeed or roll back together.
begin;
-- Copy legacy flags before the application switches to the service-managed flag.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_pin', true)
where raw_user_meta_data->'must_change_pin' = 'true'::jsonb
  and not (coalesce(raw_app_meta_data, '{}'::jsonb) ? 'must_change_pin');

create or replace function public.guard_driver_identity() returns trigger
language plpgsql set search_path = public as $$
begin
  -- SECURITY DEFINER functions run under their owner's database role.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.user_id is not null then
      raise exception 'Driver login must be provisioned securely';
    elsif tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or
      (old.user_id is not null and new.phone is distinct from old.phone)) then
      raise exception 'Driver login and phone cannot be changed directly';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_driver_identity on public.drivers;
create trigger guard_driver_identity before insert or update on public.drivers
for each row execute function public.guard_driver_identity();

create or replace function public.provision_driver_login(p_driver_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_existing uuid;
begin
  select tenant_id, user_id into v_tenant, v_existing from public.drivers where id = p_driver_id for update;
  if v_tenant is null then raise exception 'Driver not found'; end if;
  if v_existing is not null and v_existing <> p_user_id then raise exception 'Driver already linked'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Driver login was not created'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user_id)
    or exists (select 1 from public.memberships where user_id = p_user_id and (tenant_id <> v_tenant or role <> 'driver')) then
    raise exception 'Account cannot be linked as driver';
  end if;
  insert into public.memberships (user_id, tenant_id, role, invited_by)
  values (p_user_id, v_tenant, 'driver', auth.uid())
  on conflict (user_id, tenant_id) do update set is_active = true, invited_by = excluded.invited_by
    where memberships.role = 'driver';
  if not found then raise exception 'Account cannot be linked as driver'; end if;
  update public.drivers set user_id = p_user_id where id = p_driver_id;
end; $$;
revoke execute on function public.provision_driver_login(uuid, uuid) from public, anon, authenticated;
grant execute on function public.provision_driver_login(uuid, uuid) to service_role;

drop policy if exists "Members can view tenant drivers" on public.drivers;
create policy "Members can view tenant drivers" on public.drivers for select to authenticated
using (public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
  or (user_id = auth.uid() and public.has_tenant_role(tenant_id, 'driver')));

-- Restrict both the old and new row, including DELETE, so admins cannot edit owners.
drop policy if exists "Owners/Admins can add memberships" on public.memberships;
create policy "Owners/Admins can add memberships" on public.memberships for insert to authenticated
with check (public.has_tenant_role(tenant_id, 'owner') or
  (role <> 'owner' and public.has_tenant_role(tenant_id, 'admin')));
drop policy if exists "Owners/Admins can update memberships" on public.memberships;
create policy "Owners/Admins can update memberships" on public.memberships for update to authenticated
using (public.has_tenant_role(tenant_id, 'owner') or (role <> 'owner' and public.has_tenant_role(tenant_id, 'admin')))
with check (public.has_tenant_role(tenant_id, 'owner') or (role <> 'owner' and public.has_tenant_role(tenant_id, 'admin')));
drop policy if exists "Owners/Admins can delete memberships" on public.memberships;
create policy "Owners/Admins can delete memberships" on public.memberships for delete to authenticated
using (public.has_tenant_role(tenant_id, 'owner') or (role <> 'owner' and public.has_tenant_role(tenant_id, 'admin')));

create or replace function public.create_tenant_with_owner(
  tenant_name text, tenant_business_name text default null, tenant_phone text default null,
  tenant_email text default null, tenant_plan text default 'starter'
) returns json language plpgsql security definer set search_path = public as $$
declare new_tenant_id uuid; new_membership_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- Serialize concurrent creations for this user.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if (select count(*) from public.memberships where user_id = auth.uid() and role = 'owner') >= 3 then
    raise exception 'A user may own at most three fleets';
  end if;
  insert into public.tenants (name, business_name, phone, email, plan)
  values (tenant_name, tenant_business_name, tenant_phone, tenant_email, 'starter') returning id into new_tenant_id;
  insert into public.memberships (user_id, tenant_id, role) values (auth.uid(), new_tenant_id, 'owner') returning id into new_membership_id;
  return json_build_object('tenant_id', new_tenant_id, 'membership_id', new_membership_id, 'success', true);
end; $$;
revoke execute on function public.create_tenant_with_owner(text,text,text,text,text) from public, anon;
grant execute on function public.create_tenant_with_owner(text,text,text,text,text) to authenticated;

-- Preserve live policy expressions, commands, mode, and comments, including
-- any changes from 016 or the target database. PostgreSQL records direct
-- function references in pg_depend, avoiding fragile textual SQL matching.
-- PUBLIC includes anon; replace it with authenticated (and retain other
-- explicitly listed roles except anon, which cannot execute these helpers).
do $policy_roles$
declare
  p record;
  target_roles text;
begin
  for p in
    select pp.*, pol.oid as policy_oid, pg_catalog.obj_description(pol.oid, 'pg_policy') as policy_comment
    from pg_catalog.pg_policies pp
    join pg_catalog.pg_namespace n on n.nspname = pp.schemaname
    join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = pp.tablename
    join pg_catalog.pg_policy pol on pol.polrelid = c.oid and pol.polname = pp.policyname
    where 'public' = any(pp.roles)
      and exists (
        select 1 from pg_catalog.pg_depend dep
        join pg_catalog.pg_proc proc on proc.oid = dep.refobjid
        join pg_catalog.pg_namespace fn_ns on fn_ns.oid = proc.pronamespace
        where dep.classid = 'pg_catalog.pg_policy'::regclass and dep.objid = pol.oid
          and dep.refclassid = 'pg_catalog.pg_proc'::regclass
          and fn_ns.nspname = 'public'
          and proc.oid in (
            'public.current_tenant_ids()'::regprocedure,
            'public.has_tenant_role(uuid,text)'::regprocedure,
            'public.has_any_tenant_role(uuid,text[])'::regprocedure,
            'public.is_system_admin()'::regprocedure,
            'public.current_driver_ids()'::regprocedure,
            'public.current_driver_vehicle_ids(uuid)'::regprocedure
          )
      )
  loop
    select string_agg(quote_ident(role_name), ', ' order by role_name) into target_roles
    from (select distinct unnest(p.roles || array['authenticated']::name[]) as role_name) roles
    where role_name not in ('public', 'anon');
    execute format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, target_roles,
      case when p.qual is null then '' else ' USING (' || p.qual || ')' end,
      case when p.with_check is null then '' else ' WITH CHECK (' || p.with_check || ')' end);
    if p.policy_comment is not null then
      execute format('COMMENT ON POLICY %I ON %I.%I IS %L', p.policyname, p.schemaname, p.tablename, p.policy_comment);
    end if;
    raise notice 'Restricted policy %.%: %', p.schemaname, p.tablename, p.policyname;
  end loop;
end;
$policy_roles$;

revoke execute on function public.current_tenant_ids() from public, anon;
revoke execute on function public.has_tenant_role(uuid,text) from public, anon;
revoke execute on function public.has_any_tenant_role(uuid,text[]) from public, anon;
revoke execute on function public.is_system_admin() from public, anon;
revoke execute on function public.current_driver_ids() from public, anon;
revoke execute on function public.current_driver_vehicle_ids(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_fuel_photo_expiry() from public, anon, authenticated;
grant execute on function public.current_tenant_ids(), public.has_tenant_role(uuid,text), public.has_any_tenant_role(uuid,text[]), public.is_system_admin(), public.current_driver_ids(), public.current_driver_vehicle_ids(uuid) to authenticated;

commit;
