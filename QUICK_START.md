# 🚀 FaidaFleet Quick Start Guide

## ⚠️ Important: Database Setup Required

**You're seeing the tenant creation error because the database tables don't exist yet in Supabase.**

Before you can use the app, you need to set up the database tables in Supabase.

## Step-by-Step Setup

### 1. Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **fohshifanqdhzbzhddkq**
3. Click on **SQL Editor** in the left sidebar (looks like a document icon)

### 2. Run the Database Migration

1. Click **New Query** button
2. Open the file in your project: `supabase/migrations/001_initial_schema.sql`
3. Copy **ALL** the content from that file (476 lines)
4. Paste it into the Supabase SQL Editor
5. Click **Run** button (or press Ctrl+Enter)
6. Wait for "Success. No rows returned" message

### 3. Verify Tables Created

After running the migration, go to **Table Editor** in the left sidebar. You should see these 10 tables:

- ✅ `tenants` - Fleet companies
- ✅ `profiles` - User profiles  
- ✅ `memberships` - User-tenant relationships
- ✅ `drivers` - Driver information
- ✅ `vehicles` - Vehicle information
- ✅ `driver_assignments` - Vehicle-driver assignments
- ✅ `collections` - Daily collections
- ✅ `mpesa_transactions` - M-Pesa payment records
- ✅ `expenses` - Fleet expenses
- ✅ `maintenance_logs` - Vehicle maintenance records

### 4. Test the Application

1. **Refresh** your browser at http://localhost:9002

2. Try the **onboarding flow** again:
   - Fill in your fleet name
   - Choose a plan
   - Click "Create Fleet & Get Started"

3. You should be redirected to `/dashboard` successfully! 🎉

## 🐛 Troubleshooting Common Errors

### "Tenant creation error: {}" or "Database not set up"

**Problem**: Database tables don't exist yet  
**Solution**: Follow steps 1-2 above to run the migration

**How to check**: Go to Supabase → Table Editor. If you don't see any tables, the migration wasn't run.

### "relation 'tenants' does not exist"

**Problem**: Migration not run or partially failed  
**Solution**: 
1. Delete any partial tables in Supabase Table Editor
2. Re-run the **entire** migration script (all 476 lines)

### "permission denied for table tenants"

**Problem**: Row Level Security blocking access  
**Solution**: The migration includes RLS policies automatically. Make sure:
1. You're logged in (check browser console for auth status)
2. The migration was run completely
3. Try logging out and back in

### TypeScript Errors (Red squiggly lines in VS Code)

**Problem**: Type definitions not generated from database  
**Solution**: These are just TypeScript warnings - the code will still work! To fix:
```bash
npx supabase gen types typescript --project-id fohshifanqdhzbzhddkq > src/lib/database.types.ts
```

## 📝 What's Next After Setup?

After running the migration successfully:

1. ✅ **Complete Onboarding** - Create your fleet account
2. ✅ **Add Vehicles** - Register your matatus (`/vehicles`)
3. ✅ **Register Drivers** - Add driver information (`/drivers`)
4. ✅ **Track Collections** - Record daily collections (`/collections`)
5. ✅ **Monitor Expenses** - Track fuel, maintenance, etc. (`/expenses`)
6. ✅ **View Dashboard** - See analytics and KPIs (`/dashboard`)

## � Quick Test Checklist

- [ ] Migration run in Supabase SQL Editor
- [ ] 10 tables visible in Table Editor
- [ ] Browser refreshed at http://localhost:9002
- [ ] Onboarding form submitted successfully
- [ ] Redirected to dashboard

## 🆘 Need More Help?

- **Database Schema Details**: See `DATABASE_SETUP.md`
- **Authentication Setup**: See `SUPABASE_AUTH_SETUP.md`  
- **Signup Walkthrough**: See `FLEET_OWNER_SIGNUP_GUIDE.md`
- **Full Documentation**: See `README.md`

---

**Important**: You only need to run the migration **ONCE**. After that, all the tables will persist in your Supabase database forever (unless you manually delete them).

