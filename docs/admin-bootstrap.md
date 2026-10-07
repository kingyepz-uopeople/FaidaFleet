# Admin Bootstrap Guide for FaidaFleet

> **Live Supabase Project:** `wjoyuodxqpyfdzssvado` (FaidaFleet, Vercel-linked organisation).

This guide describes how to bootstrap the initial super administrator and how to grant or manage administrative privileges for FaidaFleet.

---

## 1. Creating the First Super Administrator

Because Row Level Security (RLS) protects the `public.admin_users` table so only existing system administrators can manage it, the initial administrator must be granted access directly via Supabase Auth and the SQL Editor.

### Step 1: Create the Auth User in Supabase
1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/wjoyuodxqpyfdzssvado).
2. Navigate to **Authentication** -> **Users**.
3. Click **Add user** -> **Create user**.
4. Enter the administrator's email and a secure password.
5. Check **Auto Confirm User?** (or confirm via email).
6. Click **Create user**.

*(Alternatively, if an auth user with that email already exists, you can use the `/reset-password` flow within the app to set their password).*

---

### Step 2: Grant Super Admin Privileges in SQL Editor
1. In the Supabase Dashboard, navigate to the **SQL Editor**.
2. Run the following SQL query, replacing `'YOUR_EMAIL_HERE'` with the exact email address created in Step 1:

```sql
insert into public.admin_users (user_id, email, full_name, role, is_active)
select id, email, 'Ian Mwinga', 'super_admin', true
from auth.users
where email = 'YOUR_EMAIL_HERE'
on conflict (email) do update
  set user_id = excluded.user_id, role = 'super_admin', is_active = true;
```

3. Confirm that the query executed successfully and returned 1 affected row.

---

### Step 3: Sign In to the Admin Console
1. Navigate to `/admin-login` in your browser.
2. Sign in with the administrator email and password configured in Step 1.
3. You will be redirected to `/admin` with full system administrator privileges.

---

## 2. Adding Subsequent Administrators

Once the first super administrator is active, you have two options for adding additional administrators:

### Option A: From the Admin Interface (`/admin/users`)
1. Log in to the Admin Console as a `super_admin`.
2. Go to **Admin Users** (`/admin/users`).
3. Click **Add Admin**.
4. Enter the new administrator's email, name, role (`super_admin`, `admin`, or `moderator`), and permissions.
5. Submit the form.
   - If `SUPABASE_SERVICE_ROLE_KEY` is configured on the server, Supabase will automatically send an invitation email to the user so they can accept and set their password.
   - If the user already has an Auth account, their record is instantly linked.

### Option B: Direct SQL Grant
Repeat Steps 1 and 2 above using the new admin's email and appropriate role (`'super_admin'`, `'admin'`, or `'moderator'`).

---

## 3. Security Ground Rules

- **Never commit `.env` or credentials** to git.
- **Never hardcode admin emails or passwords** in the codebase.
- `SUPABASE_SERVICE_ROLE_KEY` must remain strictly server-side and never exposed to the client bundle or prefixed with `NEXT_PUBLIC_`.
- Server-side middleware (`src/lib/supabase/middleware.ts`) automatically validates `public.is_system_admin()` for all `/admin/*` routes to prevent unauthorized access.
