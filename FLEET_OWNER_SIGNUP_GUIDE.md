# 🚗 Fleet Owner Sign Up Guide

## Complete Step-by-Step Process

### 1️⃣ Access the Application

Open your browser and navigate to:
```
http://localhost:9002
```

You'll be automatically redirected to the **login page**.

---

### 2️⃣ Create Your Account

1. On the login page, click **"Sign up"** at the bottom
2. Fill in the registration form:
   - **Full Name**: Your name (e.g., "John Kamau")
   - **Email**: Your email address (e.g., "john@example.com")
   - **Password**: At least 6 characters
   - **Confirm Password**: Must match your password

3. Click **"Sign up"** button

4. You'll see a success message: *"Account created successfully! Redirecting to set up your fleet..."*

---

### 3️⃣ Set Up Your Fleet (Onboarding)

After 2 seconds, you'll be redirected to the **Fleet Creation** page where you'll enter:

#### Required Information:
- **Fleet Name** *(Required)*
  - Example: "Kamau Transport", "Nairobi Express", etc.
  - This is what you'll see throughout the app

#### Optional Information:
- **Business Name**
  - Your registered business name (e.g., "Kamau Transport Ltd")
  
- **Phone Number**
  - Your business phone (e.g., "+254712345678")
  
- **Business Email**
  - Your business email (e.g., "info@kamautransport.co.ke")

#### Choose Your Plan:
- **Starter (Free)** - 1-3 vehicles
- **Pro (KES 1,000/month)** - 4-10 vehicles  
- **Enterprise (Custom)** - 10+ vehicles

---

### 4️⃣ Complete Setup

1. Fill in the form with your fleet details
2. Select your plan
3. Click **"Create Fleet & Get Started"**

The system will:
- ✅ Create your fleet/tenant account
- ✅ Set you as the owner (full permissions)
- ✅ Redirect you to the dashboard

---

### 5️⃣ You're Ready! 🎉

After completing onboarding, you'll have:

- **Full owner access** to your fleet
- Ability to add **vehicles**
- Ability to add **drivers**
- Track **daily collections** (cash & M-Pesa)
- Record **expenses**
- View **dashboard analytics**
- Invite **team members** (admins, accountants, drivers)

---

## What Happens Behind the Scenes

### Database Records Created:

1. **User Profile** (`profiles` table)
   - Created automatically when you sign up
   - Stores your name and avatar

2. **Tenant** (`tenants` table)
   - Your fleet company record
   - Contains fleet name, business details, plan

3. **Membership** (`memberships` table)
   - Links you to your fleet
   - Sets your role as "owner"

### Your Permissions as Owner:

✅ **Full Control** - You can do everything:
- Manage fleet settings
- Add/edit/delete vehicles
- Add/edit/delete drivers
- Assign drivers to vehicles
- Record collections and expenses
- View all financial reports
- Invite and manage team members
- Change user roles

---

## Next Steps After Onboarding

### 1. Add Your First Vehicle
- Go to **Vehicles** page
- Click "Add Vehicle"
- Enter registration number, make, model, route

### 2. Add Your Drivers
- Go to **Drivers** page
- Click "Add Driver"
- Enter driver details and license info

### 3. Assign Drivers to Vehicles
- Go to **Driver Assignments**
- Link drivers to their vehicles

### 4. Start Tracking Collections
- Go to **Collections** page
- Record daily cash and M-Pesa collections per vehicle

### 5. Record Expenses
- Go to **Expenses** page
- Track fuel, maintenance, and other costs

---

## Troubleshooting

### "Failed to create fleet" Error

**Possible causes:**
1. Database migration not run
2. RLS policies blocking creation

**Solution:**
1. Make sure you've run the database migration:
   - Go to Supabase Dashboard → SQL Editor
   - Run the migration from `supabase/migrations/001_initial_schema.sql`

2. Check browser console for detailed errors (F12)

### Can't Access Dashboard

**Cause:** No fleet/tenant created yet

**Solution:** 
- Complete the onboarding process at `/onboarding`
- Or manually create tenant using SQL (see DATABASE_SETUP.md)

### Email Verification Required

**If you see:** "Please verify your email"

**Solution:**
1. Check your email inbox for verification link
2. Click the link to verify
3. Return to login page

**OR** Disable email verification in Supabase:
- Supabase Dashboard → Authentication → Providers
- Email → Disable "Confirm email"

---

## Team Roles Explained

When you invite team members later, you can assign these roles:

| Role | Access Level |
|------|-------------|
| **Owner** | You - Full control of everything |
| **Admin** | Manage fleet, drivers, vehicles, finances |
| **Accountant** | Record collections, expenses, view reports |
| **Driver** | Add daily collections only (limited access) |

---

## Quick Reference URLs

- **Login**: http://localhost:9002/login
- **Sign Up**: http://localhost:9002/signup
- **Onboarding**: http://localhost:9002/onboarding
- **Dashboard**: http://localhost:9002/dashboard
- **Reset Password**: http://localhost:9002/reset-password

---

## Support

For issues during sign up:
1. Check browser console (F12) for errors
2. Verify database migration is complete
3. Check `SUPABASE_AUTH_SETUP.md` for configuration
4. Review `DATABASE_SETUP.md` for database setup

---

## Example Flow

```
1. Navigate to http://localhost:9002
   ↓
2. Click "Sign up"
   ↓
3. Enter: Name, Email, Password
   ↓
4. Click "Sign up" button
   ↓
5. Auto-redirect to /onboarding
   ↓
6. Enter: Fleet Name, Business Details
   ↓
7. Select: Starter Plan
   ↓
8. Click "Create Fleet & Get Started"
   ↓
9. Welcome to your Dashboard! 🎉
```

---

**You're all set!** Start managing your matatu fleet like a pro! 🚦🚗
