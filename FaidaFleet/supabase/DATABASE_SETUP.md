# FaidaFleet Database Setup Guide

## Overview
This guide explains how to set up the complete database schema for FaidaFleet in Supabase.

## Prerequisites
- Supabase project created
- Supabase CLI installed (optional, for migrations)

## Setup Methods

### Method 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire content from `supabase/migrations/001_initial_schema.sql`
4. Paste and click **Run**
5. Wait for completion (should take 10-30 seconds)

### Method 2: Using Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref fohshifanqdhzbzhddkq

# Push the migration
npx supabase db push
```

## What Gets Created

### 1. Core Tables
- **tenants** - Fleet companies/organizations
- **profiles** - User profiles (extends auth.users)
- **memberships** - User-tenant relationships with roles

### 2. Fleet Management
- **drivers** - Driver records
- **vehicles** - Vehicle/matatu records
- **driver_assignments** - Track which driver is assigned to which vehicle

### 3. Financial Tracking
- **collections** - Daily revenue collections
- **mpesa_transactions** - M-Pesa webhook data for reconciliation
- **expenses** - Daily expenses (fuel, maintenance, etc.)
- **maintenance_logs** - Vehicle maintenance history

### 4. Security
- Row Level Security (RLS) enabled on all tables
- Policies ensure users only access their tenant's data
- Role-based permissions (owner, admin, accountant, driver)

### 5. Helper Functions
- `current_tenant_ids()` - Get user's tenant memberships
- `has_tenant_role()` - Check if user has specific role
- `has_any_tenant_role()` - Check if user has any of specified roles

### 6. Automation
- Auto-create profile on user signup
- Updated_at triggers on all tables
- Materialized view for dashboard KPIs

## Verification

After running the migration, verify the setup:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should see: collections, driver_assignments, drivers, expenses,
-- kpi_daily, maintenance_logs, memberships, mpesa_transactions,
-- profiles, tenants, vehicles
```

## Initial Data Setup

### 1. Create Your First Tenant (after signup)

```sql
-- Insert a tenant (do this via SQL Editor or your app)
INSERT INTO public.tenants (name, business_name, email, plan)
VALUES ('My Fleet', 'My Fleet Ltd', 'owner@myfleet.com', 'starter')
RETURNING id;

-- Note the returned ID, you'll need it for the membership
```

### 2. Create Membership for Yourself

```sql
-- Replace YOUR_USER_ID with your auth.users id
-- Replace TENANT_ID with the tenant id from step 1
INSERT INTO public.memberships (user_id, tenant_id, role)
VALUES ('YOUR_USER_ID', 'TENANT_ID', 'owner');
```

### 3. Add Sample Vehicle

```sql
INSERT INTO public.vehicles (tenant_id, registration_number, make, model, route)
VALUES ('TENANT_ID', 'KCA 123A', 'Toyota', 'Hiace', 'Nairobi - Thika');
```

### 4. Add Sample Driver

```sql
INSERT INTO public.drivers (tenant_id, full_name, phone, license_number)
VALUES ('TENANT_ID', 'John Kamau', '+254712345678', 'DL12345');
```

## Multi-Tenant Features

### How It Works
1. Each user can belong to multiple tenants
2. Each tenant has its own isolated data
3. Users can only see data for tenants they're members of
4. Roles control what actions users can perform

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| **owner** | Full control - manage everything including tenant settings and users |
| **admin** | Manage fleet, drivers, vehicles, collections, and expenses |
| **accountant** | Record and reconcile collections, view reports, manage expenses |
| **driver** | Add daily collections, view own assignments (read-only for most) |

### Adding Team Members

```sql
-- First, invite them to sign up via your app
-- Then add them to your tenant with a role

INSERT INTO public.memberships (user_id, tenant_id, role, invited_by)
VALUES ('NEW_USER_ID', 'YOUR_TENANT_ID', 'driver', auth.uid());
```

## Dashboard KPIs

The `kpi_daily` materialized view provides pre-calculated metrics:

```sql
-- View daily KPIs for your tenant
SELECT * FROM public.kpi_daily 
WHERE tenant_id = 'YOUR_TENANT_ID'
ORDER BY date DESC
LIMIT 30;

-- Refresh the view (run daily via cron or manually)
SELECT refresh_kpi_daily();
```

### Metrics Available
- Active vehicles & drivers per day
- Cash, M-Pesa, and Pochi totals
- Total collections
- Reconciled vs unreconciled payments
- Total expenses
- Net profit

## M-Pesa Integration

The `mpesa_transactions` table stores webhook data from Daraja API:

1. Set up Daraja API (see M-Pesa setup guide)
2. Configure webhook URL to your Edge Function
3. Edge Function saves data to `mpesa_transactions`
4. Match transactions to collections manually or automatically
5. Mark collections as reconciled

## Next Steps

1. ✅ Run the migration
2. ✅ Create your first tenant
3. ✅ Add yourself as owner
4. ✅ Add vehicles and drivers
5. 🔜 Build the frontend to interact with these tables
6. 🔜 Set up M-Pesa Daraja integration
7. 🔜 Create Edge Functions for webhooks

## Troubleshooting

### RLS Errors
If you get permission denied errors:
- Check that your user has a membership record
- Verify the membership is active (`is_active = true`)
- Check the role is correct

### Migration Errors
If the migration fails:
- Drop all tables and try again
- Check Supabase logs for specific errors
- Ensure you're using Postgres 14+

### Need to Reset?
```sql
-- ⚠️ WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
-- Then run the migration again
```

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review RLS policies in the migration file
- Test policies using SQL Editor with different user contexts
