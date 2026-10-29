-- 016_dashboard_totals.sql
-- Read-only lifetime dashboard totals. This migration is NOT applied by the app
-- or by this PR; the dashboard keeps its existing reads as a fallback until it
-- is installed. SECURITY INVOKER keeps every underlying RLS policy in force.

create or replace function public.fleet_dashboard_totals(p_tenant_id uuid)
returns table (
  total_collections numeric,
  total_expenses numeric,
  collection_count bigint,
  expense_count bigint,
  electronic_count bigint,
  reconciled_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(c.total_collections, 0),
    coalesce(e.total_expenses, 0),
    coalesce(c.collection_count, 0),
    coalesce(e.expense_count, 0),
    coalesce(c.electronic_count, 0),
    coalesce(c.reconciled_count, 0)
  from (
    select
      sum(amount) as total_collections,
      count(*) as collection_count,
      count(*) filter (where payment_method in ('mpesa', 'pochi')) as electronic_count,
      count(*) filter (where payment_method in ('mpesa', 'pochi') and reconciled) as reconciled_count
    from public.collections
    where tenant_id = p_tenant_id
      and public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
  ) c
  cross join (
    select sum(amount) as total_expenses, count(*) as expense_count
    from public.expenses
    where tenant_id = p_tenant_id
      and public.has_any_tenant_role(tenant_id, array['owner','admin','accountant'])
  ) e;
$$;

revoke all on function public.fleet_dashboard_totals(uuid) from public, anon;
grant execute on function public.fleet_dashboard_totals(uuid) to authenticated;
