-- FaidaFleet does not keep a second copy of the database.
-- Apply the migrations in supabase/migrations, in this order:
--   001_initial_schema.sql
--   002_fix_onboarding.sql
--   003_admin_tables.sql
--   004_add_trips_table.sql
--   005_add_vehicle_compliance_columns.sql
--   006_phone_pin_auth.sql
--   007_schema_fixes.sql
--
-- This file used to be a partial snapshot. Running it after the migrations
-- replaced the tenant security helpers and added another set of policies.

do $$
begin
  raise exception
    'Do not run COMPLETE_SCHEMA.sql. Apply supabase/migrations/001_initial_schema.sql through 007_schema_fixes.sql in order.';
end $$;
