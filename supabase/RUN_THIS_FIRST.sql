-- ============================================
-- FAIDAFLEET DATABASE SETUP
-- Run these migrations in order:
-- ============================================

-- Step 1: Migration 001 - Initial Schema
-- Location: supabase/migrations/001_initial_schema.sql

-- Step 2: Migration 002 - Onboarding Fixes
-- Location: supabase/migrations/002_fix_onboarding.sql

-- Step 3: Migration 003 - Admin Tables
-- Location: supabase/migrations/003_admin_tables.sql

-- Step 4: Migration 004 - Trips Table
-- Location: supabase/migrations/004_add_trips_table.sql

-- Step 5: Migration 005 - Vehicle Compliance
-- Location: supabase/migrations/005_add_vehicle_compliance_columns.sql
-- Step 6: Migration 006 - Phone and PIN auth
-- Location: supabase/migrations/006_phone_pin_auth.sql
-- Step 7: Migration 007 - Schema fixes
-- Location: supabase/migrations/007_schema_fixes.sql

-- Do not run supabase/COMPLETE_SCHEMA.sql. It is not a schema.

-- These statements add vehicle compliance columns when that table already exists.
do $$
begin
  if to_regclass('public.vehicles') is null then
    raise exception 'Run supabase/migrations/001 through 007 before RUN_THIS_FIRST.sql';
  end if;

  execute 'alter table public.vehicles add column if not exists insurance_expiry date';
  execute 'alter table public.vehicles add column if not exists mot_expiry date';
  execute 'alter table public.vehicles add column if not exists vehicle_type text';
end $$;

alter table public.vehicles drop constraint if exists vehicles_vehicle_type_check;
alter table public.vehicles add constraint vehicles_vehicle_type_check
  check (vehicle_type is null or vehicle_type in ('psv', 'cargo', 'pickup', 'other'));
