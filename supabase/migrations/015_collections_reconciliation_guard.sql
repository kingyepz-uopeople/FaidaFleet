-- 015_collections_reconciliation_guard.sql
-- Manual owner/admin collection reconciliation guard.
-- Prepared for manual review only; this migration is intentionally not applied by the application or PR.
--
-- Audit of existing collections policies (001, 007, 009, 010, 012):
--   * UPDATE ("Owners/Admins/Accountants can update collections") already blocks
--     drivers from updating collections rows.
--   * However, INSERT ("All members can record collections" in 010) does not stop
--     a driver calling PostgREST directly from supplying reconciled = true /
--     reconciled_at / reconciled_by on a new row, and UPDATE allows accountants
--     to mutate reconciliation columns directly.
--
-- Using an idempotent BEFORE INSERT OR UPDATE trigger enforces column-level
-- reconciliation rules for authenticated PostgREST callers while leaving the
-- 012 initplan-optimized RLS policies untouched.

create or replace function public.enforce_collection_reconciliation_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  can_reconcile boolean;
begin
  if tg_op = 'INSERT' then
    if new.payment_method = 'cash'
       and (coalesce(new.reconciled, false) = true or new.reconciled_at is not null or new.reconciled_by is not null) then
      raise exception 'Cash collections are recorded directly and cannot be marked reconciled.'
        using errcode = '22023';
    end if;

    if (select auth.role()) = 'authenticated'
       and (coalesce(new.reconciled, false) = true or new.reconciled_at is not null or new.reconciled_by is not null) then
      can_reconcile := public.has_any_tenant_role(new.tenant_id, array['owner', 'admin'])
        or public.is_system_admin();
      if not can_reconcile then
        raise exception 'Only fleet owners and admins can set collection reconciliation fields.'
          using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  -- UPDATE: editing amount, receipt code, or switching to cash on a reconciled
  -- row always resets it to Pending so a modified row is never left verified.
  if coalesce(old.reconciled, false) = true
     and (
       new.payment_method = 'cash'
       or new.amount is distinct from old.amount
       or nullif(btrim(coalesce(new.mpesa_receipt, '')), '') is distinct from
          nullif(btrim(coalesce(old.mpesa_receipt, '')), '')
     ) then
    new.reconciled := false;
    new.reconciled_at := null;
    new.reconciled_by := null;
    if new.payment_method = 'cash' then
      new.mpesa_receipt := null;
    end if;
    return new;
  end if;

  if new.reconciled is distinct from old.reconciled
     or new.reconciled_at is distinct from old.reconciled_at
     or new.reconciled_by is distinct from old.reconciled_by then
    if new.payment_method = 'cash' and coalesce(new.reconciled, false) = true then
      raise exception 'Cash collections are recorded directly and do not need reconciling.'
        using errcode = '22023';
    end if;

    if (select auth.role()) = 'authenticated' then
      can_reconcile := public.has_any_tenant_role(new.tenant_id, array['owner', 'admin'])
        or public.is_system_admin();
      if not can_reconcile then
        raise exception 'Only fleet owners and admins can change collection reconciliation fields.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

do $guard$
begin
  if to_regclass('public.collections') is not null then
    drop trigger if exists enforce_collection_reconciliation on public.collections;
    create trigger enforce_collection_reconciliation
      before insert or update on public.collections
      for each row execute function public.enforce_collection_reconciliation_rules();
  else
    raise notice 'Skipping enforce_collection_reconciliation trigger: public.collections does not exist.';
  end if;
end;
$guard$;
