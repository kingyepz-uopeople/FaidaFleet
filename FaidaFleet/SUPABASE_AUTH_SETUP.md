# Supabase authentication setup

FaidaFleet uses two sign-in methods on a new Supabase project.

| Who | Sign-in | Page |
| --- | --- | --- |
| Fleet owner | Phone number and PIN | `/login` and `/signup` |
| Driver | Phone number and PIN issued by the fleet | `/login` |
| System administrator | Email and password | `/admin-login` |

Phone accounts are stored in Supabase Auth with an internal address, `2547XXXXXXXX@phone.faidafleet.local`. The PIN is the password. The real phone number is saved on the profile. This avoids SMS so a new project can run without a phone provider.

## 1. Environment

Copy `.env.example` to `.env.local` in `FaidaFleet` and fill in the new project:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Keep the service role key on the server. It is used when a fleet owner adds a driver, so the owner's session stays signed in and the driver account is confirmed immediately.

## 2. Database

Run `supabase/migrations/001_initial_schema.sql` through `006_phone_pin_auth.sql` in order. Migration 006 stores the phone on new profiles, locks `admin_users` to system administrators, and adds `provision_driver_login`.

## 3. Auth settings

In Authentication, then Providers, then Email:

- Turn off Confirm email. Phone accounts cannot receive mail.
- Set the minimum password length to 4.

Leave Google and other OAuth providers disabled.

## 4. First system administrator

1. Authentication, then Users, then Add user.
2. Use a real email and a password.
3. Copy the user id.
4. Run:

```sql
insert into public.admin_users (user_id, email, full_name, role)
values ('paste-user-id', 'admin@example.com', 'System Admin', 'super_admin');
```

That insert is done in the SQL Editor, which bypasses row level security. Later administrator rows are managed from `/admin/users`.

Sign in at `http://localhost:5000/admin-login`. A fleet phone account is rejected on that page. An administrator email is rejected on the fleet phone form.

## 5. Fleet owners and drivers

- A fleet owner creates an account at `/signup` with name, phone, and PIN, then creates the fleet during onboarding.
- A fleet owner or fleet admin adds a driver on the Drivers page with a phone number and PIN. The driver uses `/login`.
- A forgotten fleet PIN is changed in Settings by the person who is signed in. There is no email reset for phone accounts.
- `/reset-password` is only for system administrator email accounts.

## Pages

- `/login` - phone and PIN
- `/signup` - fleet owner phone and PIN
- `/admin-login` - system administrator email and password
- `/reset-password` - system administrator password reset
- `/onboarding` - first fleet setup after owner sign-up
