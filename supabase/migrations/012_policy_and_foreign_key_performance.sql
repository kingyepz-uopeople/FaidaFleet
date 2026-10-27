-- 012_policy_and_foreign_key_performance.sql
-- Prepared for review only. Do not apply from the application or this PR.
--
-- Recreate each existing policy in public that directly calls a
-- zero-argument Supabase auth helper, replacing ONLY those calls with scalar
-- SELECTs. This preserves each policy's existing USING, WITH CHECK, command,
-- roles, permissive/restrictive mode and comment. It never creates a policy
-- that is absent or combines overlapping policies. In particular, the current
-- 010 driver/tenant predicates are read from the catalog, not overwritten with
-- older, broader definitions.
--
-- In migrations 001-011 the direct calls occur in these 13 active public policies:
--   profiles: Users can view/update/insert own profile (3)
--   memberships: Users can view their memberships (1)
--   trips: Drivers can record own trips; Members can view trips (2)
--   collections: All members can record collections; Members can view tenant collections (2)
--   expenses: Members can view tenant expenses (1)
--   maintenance_logs: Members can view maintenance logs (1)
--   support_tickets: Members create tenant tickets (1)
--   support_messages: Members send ticket messages (1)
--   audit_logs: Users insert own audit logs (1)
-- The advisor's reported 19 may include additional policies present in the
-- target database but not this migration history. The catalog-driven rewrite
-- also covers additional public policies if they directly use
-- auth.uid/role/jwt/email, without guessing their names or changing their
-- access rules. It does not alter any storage policies, including the fuel-photo
-- read policy from 011. The older tenant-creation and self-membership policies
-- removed in 009 must NOT be brought back.

-- The catalog deparser emits SQL string/identifier quotes. Split the
-- expression into quoted and unquoted segments so literal text is untouched.
-- This temporary helper protects already-wrapped calls, making a second run a
-- no-op. Only Supabase's stable zero-argument auth helpers are considered.
create or replace function pg_temp.faidafleet_wrap_auth_segment(segment text)
returns text
language plpgsql
as $function$
declare
  masked text;
  rewritten text;
begin
  -- Do not treat an existing identifier as one of our temporary markers.
  if segment ~* '__FAIDAFLEET_INITPLAN_(uid|role|jwt|email)__' then
    raise notice 'Skipping an RLS expression containing the temporary marker; review it manually.';
    return segment;
  end if;
  masked := regexp_replace(
    segment,
    $regex$\(\s*SELECT\s+auth\.(uid|role|jwt|email)\s*\(\s*\)(\s+AS\s+[a-z_][a-z_0-9]*)?\s*\)$regex$,
    $replacement$__FAIDAFLEET_INITPLAN_\1__$replacement$,
    'gi'
  );
  if masked !~* $regex$(^|[^[:alnum:]_".])auth\.(uid|role|jwt|email)\s*\(\s*\)$regex$ then
    return segment;
  end if;

  rewritten := regexp_replace(
    masked,
    $regex$(^|[^[:alnum:]_".])auth\.(uid|role|jwt|email)\s*\(\s*\)$regex$,
    $replacement$\1(SELECT auth.\2())$replacement$,
    'gi'
  );
  return regexp_replace(
    rewritten,
    $regex$__FAIDAFLEET_INITPLAN_(uid|role|jwt|email)__$regex$,
    $replacement$(SELECT auth.\1())$replacement$,
    'gi'
  );
end;
$function$;

create or replace function pg_temp.faidafleet_auth_initplans(expression text)
returns text
language plpgsql
as $function$
declare
  result text := '';
  segment text := '';
  quote_character text;
  current_character text;
  escape_string boolean;
  position_in_expression integer := 1;
begin
  if expression is null then return null; end if;
  while position_in_expression <= length(expression) loop
    current_character := substr(expression, position_in_expression, 1);
    if current_character = '''' or current_character = '"' then
      -- PostgreSQL deparses escape strings as E'...'. Ordinary strings use
      -- standard-conforming quoting; doubled quotes work in both forms.
      escape_string := current_character = '''' and segment ~* '(^|[^[:alnum:]_])e$';
      result := result || pg_temp.faidafleet_wrap_auth_segment(segment) || current_character;
      segment := '';
      quote_character := current_character;
      position_in_expression := position_in_expression + 1;
      while position_in_expression <= length(expression) loop
        current_character := substr(expression, position_in_expression, 1);
        result := result || current_character;
        if escape_string and current_character = E'\\' and position_in_expression < length(expression) then
          position_in_expression := position_in_expression + 1;
          result := result || substr(expression, position_in_expression, 1);
        elsif current_character = quote_character then
          if substr(expression, position_in_expression + 1, 1) = quote_character then
            position_in_expression := position_in_expression + 1;
            result := result || quote_character;
          else
            position_in_expression := position_in_expression + 1;
            exit;
          end if;
        end if;
        position_in_expression := position_in_expression + 1;
      end loop;
    else
      segment := segment || current_character;
      position_in_expression := position_in_expression + 1;
    end if;
  end loop;
  return result || pg_temp.faidafleet_wrap_auth_segment(segment);
end;
$function$;

do $policies$
declare
  policy_row record;
  new_qual text;
  new_check text;
  policy_roles text;
  policy_comment text;
begin
  for policy_row in
    select p.*, pg_catalog.obj_description(pol.oid, 'pg_policy') as original_comment
      from pg_catalog.pg_policies p
      join pg_catalog.pg_namespace n on n.nspname = p.schemaname
      join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = p.tablename
      join pg_catalog.pg_policy pol on pol.polrelid = c.oid and pol.polname = p.policyname
     where p.schemaname = 'public'
       and (coalesce(p.qual, '') ~* $regex$auth\.(uid|role|jwt|email)\s*\($regex$
         or coalesce(p.with_check, '') ~* $regex$auth\.(uid|role|jwt|email)\s*\($regex$)
  loop
    new_qual := pg_temp.faidafleet_auth_initplans(policy_row.qual);
    new_check := pg_temp.faidafleet_auth_initplans(policy_row.with_check);
    if new_qual is not distinct from policy_row.qual
       and new_check is not distinct from policy_row.with_check then
      continue;
    end if;

    select string_agg(case when role_name = 'public' then 'PUBLIC' else quote_ident(role_name) end, ', ')
      into policy_roles
      from unnest(policy_row.roles) as r(role_name);
    policy_comment := policy_row.original_comment;

    execute format('DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    execute format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename,
      policy_row.permissive, policy_row.cmd, policy_roles,
      case when new_qual is null then '' else ' USING (' || new_qual || ')' end,
      case when new_check is null then '' else ' WITH CHECK (' || new_check || ')' end);
    if policy_comment is not null then
      execute format('COMMENT ON POLICY %I ON %I.%I IS %L',
        policy_row.policyname, policy_row.schemaname, policy_row.tablename, policy_comment);
    end if;
    raise notice 'Optimized policy %.%: %', policy_row.schemaname, policy_row.tablename, policy_row.policyname;
  end loop;
end;
$policies$;

-- Each index leads with the foreign-key column (a tenant-first or partial
-- index does not cover lookups/deletes for all referenced rows). The first 14
-- are fleet/financial FKs; the last four were also unindexed in 001-011.
-- Check the live catalog first: IF NOT EXISTS alone checks only the index name
-- and could otherwise add a duplicate under a different name.
do $indexes$
declare
  spec record;
  covered boolean;
begin
  for spec in
    select * from (values
      ('idx_fk_memberships_invited_by', 'memberships', 'invited_by'),
      ('idx_fk_drivers_user_id', 'drivers', 'user_id'),
      ('idx_fk_driver_assignments_driver_id', 'driver_assignments', 'driver_id'),
      ('idx_fk_driver_assignments_vehicle_id', 'driver_assignments', 'vehicle_id'),
      ('idx_fk_collections_vehicle_id', 'collections', 'vehicle_id'),
      ('idx_fk_collections_driver_id', 'collections', 'driver_id'),
      ('idx_fk_collections_reconciled_by', 'collections', 'reconciled_by'),
      ('idx_fk_collections_recorded_by', 'collections', 'recorded_by'),
      ('idx_fk_mpesa_transactions_matched_collection_id', 'mpesa_transactions', 'matched_collection_id'),
      ('idx_fk_expenses_vehicle_id', 'expenses', 'vehicle_id'),
      ('idx_fk_expenses_recorded_by', 'expenses', 'recorded_by'),
      ('idx_fk_maintenance_logs_vehicle_id', 'maintenance_logs', 'vehicle_id'),
      ('idx_fk_maintenance_logs_recorded_by', 'maintenance_logs', 'recorded_by'),
      ('idx_fk_trips_recorded_by', 'trips', 'recorded_by'),
      ('idx_fk_support_tickets_assigned_to', 'support_tickets', 'assigned_to'),
      ('idx_fk_support_tickets_created_by', 'support_tickets', 'created_by'),
      ('idx_fk_support_messages_sender_id', 'support_messages', 'sender_id'),
      ('idx_fk_pin_reset_log_target_driver_id', 'pin_reset_log', 'target_driver_id')
    ) as indexes(index_name, table_name, column_name)
  loop
    if to_regclass(format('public.%I', spec.table_name)) is null then
      raise notice 'Skipping index %: table public.% does not exist.', spec.index_name, spec.table_name;
      continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = spec.table_name
        and column_name = spec.column_name
    ) then
      raise notice 'Skipping index %: column public.%.% does not exist.', spec.index_name, spec.table_name, spec.column_name;
      continue;
    end if;

    select exists (
      select 1 from pg_catalog.pg_index i
      join pg_catalog.pg_class t on t.oid = i.indrelid
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
      where n.nspname = 'public' and t.relname = spec.table_name
        and a.attname = spec.column_name
        and i.indisvalid and i.indisready and i.indpred is null
    ) into covered;

    if not covered then
      execute format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
        spec.index_name, spec.table_name, spec.column_name);
      -- If the name already existed on another table/column, IF NOT EXISTS
      -- would silently skip it. Abort instead of claiming this FK is covered.
      select exists (
        select 1 from pg_catalog.pg_index i
        join pg_catalog.pg_class t on t.oid = i.indrelid
        join pg_catalog.pg_namespace n on n.oid = t.relnamespace
        join pg_catalog.pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
        where n.nspname = 'public' and t.relname = spec.table_name
          and a.attname = spec.column_name
          and i.indisvalid and i.indisready and i.indpred is null
      ) into covered;
      if not covered then
        raise exception 'Could not create an index for public.%.%', spec.table_name, spec.column_name;
      end if;
    end if;
  end loop;
end;
$indexes$;

-- 001 declares trans_id UNIQUE and separately creates idx_mpesa_trans_id on
-- the same column. Drop only the redundant non-unique index, and only if the
-- actual catalog confirms an equivalent, valid, non-partial unique index.
do $duplicate$
begin
  if exists (
    select 1
      from pg_catalog.pg_index redundant
      join pg_catalog.pg_index keeper on keeper.indrelid = redundant.indrelid
      join pg_catalog.pg_class redundant_class on redundant_class.oid = redundant.indexrelid
      join pg_catalog.pg_class keeper_class on keeper_class.oid = keeper.indexrelid
     where redundant.indexrelid = to_regclass('public.idx_mpesa_trans_id')
       and keeper.indexrelid = to_regclass('public.mpesa_transactions_trans_id_key')
       and redundant.indrelid = to_regclass('public.mpesa_transactions')
       and redundant.indisvalid and keeper.indisvalid
       and redundant.indisready and keeper.indisready
       and not redundant.indisunique and keeper.indisunique
       and redundant.indpred is null and keeper.indpred is null
       and redundant.indexprs is null and keeper.indexprs is null
       and redundant.indnkeyatts = 1 and redundant.indnatts = 1
       and redundant.indnkeyatts = keeper.indnkeyatts
       and redundant.indnatts = keeper.indnatts
       and redundant.indkey = keeper.indkey
       and redundant.indclass = keeper.indclass
       and redundant.indcollation = keeper.indcollation
       and redundant.indoption = keeper.indoption
       and redundant_class.relam = keeper_class.relam
       and exists (
         select 1 from pg_catalog.pg_attribute a
          where a.attrelid = redundant.indrelid and a.attnum = redundant.indkey[0]
            and a.attname = 'trans_id' and not a.attisdropped
       )
       and exists (
         select 1 from pg_catalog.pg_constraint
          where conrelid = keeper.indrelid and conindid = keeper.indexrelid and contype = 'u'
       )
       and not exists (select 1 from pg_catalog.pg_constraint where conindid = redundant.indexrelid)
  ) then
    drop index if exists public.idx_mpesa_trans_id;
  else
    raise notice 'Duplicate M-Pesa index not confirmed; leaving it unchanged.';
  end if;
end;
$duplicate$;
