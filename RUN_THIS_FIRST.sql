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

-- Step 5: Migration 005 - Vehicle Compliance (NEW)
-- Location: supabase/migrations/005_add_vehicle_compliance_columns.sql

-- ============================================
-- Or run the complete schema all at once:
-- Location: COMPLETE_SCHEMA.sql
-- ============================================

-- This quick fix adds just the missing columns:
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS insurance_expiry DATE;

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS mot_expiry DATE;

ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT CHECK (vehicle_type IN ('psv', 'cargo', 'pickup', 'other'));
