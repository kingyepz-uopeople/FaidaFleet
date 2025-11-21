-- Fix for onboarding: Allow users to create tenants and immediately become owners
-- This handles the chicken-and-egg problem with RLS

-- ============================================
-- 1. UPDATE MEMBERSHIPS POLICY FOR INSERT
-- ============================================

-- Drop the existing restrictive policy for memberships insert
drop policy if exists "Owners/Admins can manage memberships" on public.memberships;

-- Create separate policies for better control
create policy "Owners/Admins can view memberships"
  on public.memberships for select
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

create policy "Owners/Admins can update memberships"
  on public.memberships for update
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

create policy "Owners/Admins can delete memberships"
  on public.memberships for delete
  using (has_any_tenant_role(tenant_id, array['owner', 'admin']));

-- IMPORTANT: Allow authenticated users to create their first membership (for onboarding)
create policy "Users can create their own membership"
  on public.memberships for insert
  with check (auth.uid() = user_id);

-- ============================================
-- 2. CREATE HELPER FUNCTION FOR ONBOARDING
-- ============================================

-- Function to create tenant and membership in one transaction
create or replace function public.create_tenant_with_owner(
  tenant_name text,
  tenant_business_name text default null,
  tenant_phone text default null,
  tenant_email text default null,
  tenant_plan text default 'starter'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  new_membership_id uuid;
  result json;
begin
  -- Check if user is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Create the tenant
  insert into public.tenants (name, business_name, phone, email, plan)
  values (tenant_name, tenant_business_name, tenant_phone, tenant_email, tenant_plan)
  returning id into new_tenant_id;

  -- Create the membership (user as owner)
  insert into public.memberships (user_id, tenant_id, role)
  values (auth.uid(), new_tenant_id, 'owner')
  returning id into new_membership_id;

  -- Return the result
  select json_build_object(
    'tenant_id', new_tenant_id,
    'membership_id', new_membership_id,
    'success', true
  ) into result;

  return result;
end;
$$;

-- Grant execute permission
grant execute on function public.create_tenant_with_owner to authenticated;

-- ============================================
-- 3. ADD COMMENT FOR DOCUMENTATION
-- ============================================

comment on function public.create_tenant_with_owner is 
'Creates a new tenant and automatically adds the calling user as owner. Used during onboarding.';
