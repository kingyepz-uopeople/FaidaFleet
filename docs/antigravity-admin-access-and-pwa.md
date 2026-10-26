# Antigravity task: System admin access + make FaidaFleet a PWA

> **Update (7 Oct 2026):** The live Supabase project for this app is `wjoyuodxqpyfdzssvado` (FaidaFleet, Vercel-linked org). The old project `fohshifanqdhzbzhddkq` is paused and unused, so ignore it. The first super admin (`admin@faidafleet.com`) is being created directly in Supabase, outside the app. So in Part A, **skip creating the bootstrap SQL step for Ian**. Still write `docs/admin-bootstrap.md` for adding future admins, and still do the server-side middleware guard, the optional "Add admin" server action, and the `last_login` update. Never put the admin email or password in code.

Stack: Next.js 16 (App Router, `src/app`), Supabase (`@supabase/ssr`), Tailwind, shadcn/ui. Deployed on Vercel with a webpack build (`next build`).

## Ground rules (apply to both parts)
- Create and work on a new branch: `feat/admin-access-and-pwa`. Do NOT commit to `main`.
- Keep the existing stack. No new UI frameworks or component libraries.
- Never commit `.env*`. Never hardcode passwords, emails, or keys.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only (never imported from a `'use client'` file or exposed via `NEXT_PUBLIC_*`).
- Do NOT run SQL against the live Supabase project. Write migration files only; Ian applies them himself.
- `npm run build` must pass at the end. Run `npm run lint` too if configured.

---

## Part A: System admin access

### What's there now
- Admin UI: `src/app/admin/**` (layout + overview, analytics, billing, collections, compliance, drivers, fleet-owners, plans, settings, support, users).
- Admin login: `src/app/admin-login/page.tsx`. It uses email + password through `supabase.auth.signInWithPassword`, then checks for an active row in `public.admin_users` where `user_id = auth.uid()`. If there is no row it signs the user out with "This email is not a system administrator".
- Admin role source: the `public.admin_users` table (`supabase/migrations/003_admin_tables.sql`). Columns: `user_id -> auth.users`, `email`, `full_name`, `role in ('super_admin','admin','moderator')`, `is_active`. `public.is_system_admin()` (SECURITY DEFINER, `006_phone_pin_auth.sql`) gives the RLS gate used throughout `007_schema_fixes.sql`.
- Guarding: `src/middleware.ts` -> `src/lib/supabase/middleware.ts` only checks that a user is logged in (`/admin-login` is public through `src/lib/auth-paths.ts`). The admin role check happens **client-side only** in `src/app/admin/layout.tsx` (a `useEffect` query on `admin_users`).

### Why Ian can't log in
1. No migration or seed ever inserts an admin. `admin_users` is empty.
2. Chicken-and-egg problem: RLS only lets an existing system admin insert into `admin_users`. So nobody can add the first admin from the app.
3. There is no admin username/password anywhere, and that's correct. Admins are ordinary Supabase Auth email users with a row in `admin_users`.

### Goal
Ian gets a working, secure admin login. The admin area is enforced on the server, not just in the client.

### Steps
1. **Bootstrap doc, no code secrets.** Create `docs/admin-bootstrap.md` explaining these steps:
   - a. In Supabase Dashboard -> Authentication -> Users -> "Add user", create an email/password user (Auto Confirm) for Ian's email. Or use the existing `/reset-password` flow if the user already exists.
   - b. In the Supabase SQL Editor, run the grant SQL below. Ian runs it himself.
   - c. Sign in at `/admin-login`.
2. **Server-side guard.** In `src/lib/supabase/middleware.ts`, for paths starting with `/admin` (but not `/admin-login`): after `getUser()`, call `supabase.rpc('is_system_admin')`. If it's false, redirect to `/admin-login` for anonymous users and to `/dashboard` for other users. Preserve cookies as the existing comments require. Keep the client check in `admin/layout.tsx` as a UX fallback only.
3. **Optional, recommended: server action for adding more admins.** In `/admin/users`, add "Add admin" (super_admin only). It's a server action that verifies `is_system_admin()` and the caller's `role = 'super_admin'`, then inserts into `admin_users` for an existing auth user looked up by email. If the user needs to be created/invited, use the service-role client on the server only (`auth.admin.inviteUserByEmail`). No passwords are typed or stored by the app.
4. Update `last_login` on a successful admin sign-in (non-blocking).
5. Don't add a migration that seeds a specific email. The grant stays a manual one-time SQL step.

### Grant SQL (for Ian to run manually, with the placeholder replaced)
```sql
insert into public.admin_users (user_id, email, full_name, role, is_active)
select id, email, 'Ian Mwinga', 'super_admin', true
from auth.users
where email = 'YOUR_EMAIL_HERE'
on conflict (email) do update
  set user_id = excluded.user_id, role = 'super_admin', is_active = true;
```

### Acceptance criteria
- After the bootstrap, Ian signs in at `/admin-login` and lands on `/admin`.
- A non-admin user (fleet owner/driver) who visits `/admin` directly is redirected by middleware without any admin page flashing.
- Logged-out visitors to `/admin/*` are sent to `/admin-login`.
- No password, email, or service key is in the repo. The service role key is not in the client bundle (grep `.next/static`).
- `npm run build` passes.

---

## Part B: Make FaidaFleet a PWA

### Current state
- There is no `public/` folder. The only icon is `src/app/favicon.ico`.
- No manifest, service worker, or icons. `src/app/layout.tsx` exports `metadata` but has no manifest or theme color.
- `next.config.ts` has no PWA config. The build uses webpack on Vercel.

### Approach (Next 16 native, no heavy plugin)
1. **Manifest:** add `src/app/manifest.ts` (`MetadataRoute.Manifest`) with: `name: 'FaidaFleet'`, `short_name: 'FaidaFleet'`, `description`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `background_color`, `theme_color` (match the brand color in Tailwind/globals.css), `icons` (192, 512, plus 512 maskable).
2. **Icons:** create `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `src/app/apple-icon.png` (180x180). Build them from the existing brand/logo. If there's no logo, make a simple placeholder with the "FF" monogram on the brand color, and say so in the PR.
3. **Metadata:** in `src/app/layout.tsx` add `export const viewport = { themeColor: '...' }` and `appleWebApp: { capable: true, title: 'FaidaFleet', statusBarStyle: 'default' }` to `metadata`.
4. **Service worker:** add a hand-written `public/sw.js`. Don't use next-pwa. Serwist is acceptable only if it builds cleanly with webpack. Behavior:
   - Precache `/offline` and the icons at install. `skipWaiting` + `clients.claim`.
   - Navigation requests: network-first, falling back to `/offline`.
   - Static assets (`/_next/static/*`, icons, fonts): cache-first.
   - NEVER cache Supabase API/auth requests, `/auth/*`, POST requests, or anything with an Authorization header. Pass them straight to the network.
   - Version the cache name and delete old caches on activate.
5. **Registration:** add a small `'use client'` component (e.g. `src/components/pwa/register-sw.tsx`) that registers `/sw.js` in production only. Mount it in the root layout.
6. **Offline page:** `src/app/offline/page.tsx`, a static, friendly "You're offline" page with a retry button. Add `/offline` to `PUBLIC_PREFIXES` in `src/lib/auth-paths.ts` so middleware doesn't redirect it. Also make sure middleware's matcher excludes `sw.js`, `manifest.webmanifest`, and `icons/`.
7. **Install prompt:** a small, dismissible "Install FaidaFleet" button/banner using the `beforeinstallprompt` event. Show it in the dashboard/driver layouts (not on the admin screens). Remember dismissal in localStorage. On iOS, show a short "Share -> Add to Home Screen" hint instead.
8. **Headers:** in `next.config.ts` add `headers()` for `/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate` and `Service-Worker-Allowed: /`. Keep the existing config intact.

### Acceptance criteria
- `npm run build` passes (webpack) and the Vercel preview deploys.
- `/manifest.webmanifest` serves valid JSON. Chrome DevTools -> Application shows the manifest, icons, and an active service worker without errors.
- Lighthouse (or the DevTools installability check) reports the app as installable. The install prompt appears on Android/desktop Chrome.
- In airplane mode, navigating shows `/offline`. Login, logout, and Supabase data still work online, and no auth responses are cached.
- Unauthenticated access to `sw.js`, the manifest, and the icons isn't redirected to `/login`.

---

## Deliverable
One PR from `feat/admin-access-and-pwa` with a summary of the changes, a list of the manual steps for Ian (the grant SQL + creating the auth user), and test notes.


## Part C: Rework pricing plans

### Current state (audited 2026-10-07)
- **DB table `public.plans`** (`supabase/migrations/003_admin_tables.sql`): `id uuid`, `name text UNIQUE` (no slug/key column), `price numeric(10,2)`, `description`, `max_vehicles int`, `max_drivers int`, `features text[]`, `is_active`, timestamps. RLS enabled, all grants revoked (admin access only). Seed at line ~131 uses `on conflict (name) do nothing`.
- **Live rows (project wjoyuodxqpyfdzssvado):**
  | name | price | max_vehicles | max_drivers | features |
  |---|---|---|---|---|
  | Starter | 0 | 10 | 15 | Basic dashboard, Driver management, Vehicle tracking |
  | Pro | 99 | 100 | 150 | Advanced analytics, Real-time tracking, Expense management, M-Pesa integration |
  | Enterprise | 299 | 1000 | 5000 | Custom integrations, Priority support, API access, White-label options |
- **Tenant plan link:** `public.tenants.plan text default 'starter'` with `CHECK (plan IN ('starter','pro','enterprise'))` (`001_initial_schema.sql:20`). Not a foreign key to `plans`; it matches by lowercased name. There is **no subscriptions table** and no billing period/status columns. Live: **0 tenants**, so no subscribers need migrating today.
- **`create_tenant_with_owner(..., tenant_plan text default 'starter')`** (`002_fix_onboarding.sql:63`) sets the plan at signup.
- **Hardcoded plan lists/prices:**
  - `src/app/onboarding/page.tsx` ~L20, L181-205: user picks plan; labels "Starter (Free) 1-3 vehicles", "Pro (KES 1,000/month) 4-10 vehicles", "Enterprise (Custom) 10+ vehicles". This disagrees with the DB.
  - `src/app/admin/fleet-owners/page.tsx:47` `PLANS = ['starter','pro','enterprise']`.
  - `src/app/admin/billing/page.tsx`: reads `plans` and maps to tenants by lowercased name; hardcoded Starter/Pro/Enterprise cards.
  - `src/app/admin/analytics/page.tsx:50-52`: hardcoded per-plan counts.
  - `src/lib/database.types.ts:14,25,36,527` and `src/lib/tenant-utils.ts:86,102`: `'starter'|'pro'|'enterprise'` union.
- **Admin plans CRUD:** `src/app/admin/plans/page.tsx` (insert/update/delete/toggle on `plans`).
- **Limit enforcement: none.** Vehicles are inserted from the client (`src/app/(app)/vehicles/page.tsx:78`). Drivers are inserted in `src/app/api/drivers/route.ts:73` and then `provision_driver_login` RPC. Nothing checks `max_vehicles`/`max_drivers`.
- **Feature gating: none.** All pages (analytics, expenses, collections/M-Pesa, etc.) are available to every tenant.
- **M-Pesa:** only `mpesa_transactions` table, an AI reconciliation flow (`src/ai/flows/mpesa-reconciliation.ts`, `src/app/actions.ts`) and an `mpesa` payment method for collections. **No subscription checkout/STK billing exists.** There is also no public landing/pricing page (`src/app/page.tsx` is a redirect stub).

### Goal
| Plan | Key | Price (KES/month, integer) | Max vehicles | Max drivers | Features |
|---|---|---|---|---|---|
| Lite (new) | `lite` | 0 (Free) | 1 | 2 | Basic dashboard, Driver management |
| Starter | `starter` | 250 | 1* | 5* | Lite features + Vehicle tracking |
| Pro | `pro` | 2,500 | 100 | 150 | Advanced analytics, Real-time tracking, Expense management, M-Pesa integration |
| Enterprise | `enterprise` | 10,000 | 1000 | 5000 | Custom integrations, Priority support, API access, White-label options |

\* Starter limits are an assumption. See Open questions.

Plans are cumulative: Pro includes Starter features, and Enterprise includes Pro features.

### Steps
1. **New migration** `supabase/migrations/008_rework_pricing_plans.sql`, idempotent:
   - `alter table plans add column if not exists slug text`; backfill `slug = lower(name)`; then `set not null` + `unique`.
   - Add `feature_keys text[]` (machine keys: `basic_dashboard`, `driver_management`, `vehicle_tracking`, `advanced_analytics`, `realtime_tracking`, `expense_management`, `mpesa_integration`, `custom_integrations`, `priority_support`, `api_access`, `white_label`) and `sort_order int`. Keep `features` as the display labels.
   - Change price to an integer: `alter column price type integer using round(price)::int` (KES, no decimals). Add `check (price >= 0)`.
   - `insert ... on conflict (slug) do update` for lite/starter/pro/enterprise with the values above. **Never delete** plan rows. Old/retired plans are only set to `is_active=false`.
   - Replace the tenants check constraint: drop `tenants_plan_check`, then add a FK `tenants.plan references plans(slug) on update cascade`. Alternatively, add a check that includes `'lite'`. FK is preferred because it gives a single source of truth.
   - Change the default plan for new tenants to `'lite'`: `tenants.plan default 'lite'` and `create_tenant_with_owner` default `tenant_plan 'lite'`. Validate `tenant_plan` exists in `plans` and `is_active`.
   - **Subscriber mapping:** the live DB has 0 tenants. For any environment that has them, keep existing tenants on their current slug. Existing `starter` tenants (previously free, 10 vehicles) whose vehicle/driver count exceeds the new Starter limits must not lose data. Prefer grandfathering: add nullable `tenants.max_vehicles_override` / `max_drivers_override`, and set these to the tenant's current counts when they exceed the new limits. Alternatively, move them to `pro`, but that is a price change and needs Ian's call. Document the choice in the migration header.
   - Add `public.tenant_plan_limits(p_tenant uuid)` (security definer, stable) that returns slug, max_vehicles, max_drivers, feature_keys (with overrides applied). Add `public.tenant_has_feature(p_tenant uuid, p_feature text) returns boolean`.
   - **Enforce caps in the DB:** add `BEFORE INSERT` triggers on `vehicles` and `drivers` (and on update when `is_active` flips to true) that count active rows for `tenant_id` and `raise exception 'PLAN_LIMIT_VEHICLES'` / `'PLAN_LIMIT_DRIVERS'` when the cap is reached. This works no matter if the insert comes from the client (vehicles page) or the API route/RPC (drivers). Use `pg_advisory_xact_lock(hashtext(tenant_id::text))` to avoid races.
   - Grant `select` on active `plans` rows to `anon, authenticated` (read-only policy `is_active = true`) so onboarding/pricing UI can read plans. Writes stay admin-only.
2. **Single source of truth:** the DB `plans` table. Add `src/lib/plans.ts` with `PlanSlug`, `FeatureKey` types, `getPlans()`, `getTenantPlan()`, `hasFeature()`. Remove the hardcoded unions/lists in `database.types.ts` (regenerate types), `tenant-utils.ts`, `admin/fleet-owners/page.tsx`, `admin/billing/page.tsx`, `admin/analytics/page.tsx`, `onboarding/page.tsx`.
3. **Server-side checks:** in `src/app/api/drivers/route.ts`, pre-check the limit and map trigger errors to HTTP 402/403 with a friendly "Upgrade your plan" message. Move vehicle creation behind a server route/action, or at least catch `PLAN_LIMIT_VEHICLES` in `vehicles/page.tsx` and show an upgrade CTA.
4. **Feature gating:** a `<FeatureGate feature="...">` component + server check (layout/route-level) for: analytics/driver-analytics (`advanced_analytics`), expenses (`expense_management`), M-Pesa reconciliation/collections M-Pesa method (`mpesa_integration`), vehicle tracking/real-time (`vehicle_tracking`/`realtime_tracking`). API access, white-label, custom integrations and priority support are flags only for now (no code to gate yet). Hide nav items for locked features, and show an upgrade card instead of a 404.
5. **UI:** onboarding plan picker reads from `plans` (Lite default; shows KES price, limits, features). Admin `plans` page: show/edit `slug` (read-only after create), integer price, feature keys, sort order. Replace delete with deactivate when tenants reference the plan. Billing/analytics pages iterate plans dynamically (include Lite). Format prices as `KES 2,500/month`, and Free for 0.
6. **Payments:** Lite (price 0) needs no checkout; select it directly. There is no M-Pesa subscription checkout today. Paid plans can stay admin-assigned for now (or add an STK flow later as a separate task). Make sure nothing tries to charge a 0 price plan.

### Constraints
- Write the migration file only. **Ian applies it**; do not run SQL against the live project.
- `npm run build` (and typecheck/lint) must pass.
- Stay on branch `feat/admin-access-and-pwa`.
- No secrets in code or logs.

### Acceptance criteria
- `plans` has exactly 4 active rows (lite/starter/pro/enterprise) with the goal values. Price is an integer in KES. Slugs are unique. Re-running the migration makes no changes.
- No plan row is deleted. Tenants reference plans by slug, and `'lite'` is valid and is the default for new tenants.
- A Lite tenant cannot create a 2nd vehicle or a 3rd driver. The block happens at the DB level (trigger) even with a direct Supabase client call, and the UI shows an upgrade message.
- Locked features are hidden/blocked for lower plans and available on higher plans.
- Onboarding, admin plans, admin billing, fleet owners, and analytics show all 4 plans from the DB. No hardcoded prices remain (grep for `1,000/month`, `'starter' | 'pro'`).
- Choosing Lite in onboarding needs no payment step.
- Build passes.

### Open questions (need Ian's confirmation)
- **Starter limits:** we assumed 1 vehicle / 5 drivers. With 1 vehicle, Starter only differs from Lite by +3 drivers and vehicle tracking. Confirm or adjust.
- Grandfather vs. auto-upgrade for existing over-limit tenants. This doesn't matter today because the live DB has 0 tenants.
- Should paid plans get an M-Pesa STK subscription checkout now or later?


## Part D: IntaSend M-Pesa checkout for paid plans

Branch: `feat/admin-access-and-pwa` (same branch as Parts A-C). Ian applies migrations himself. Plans come from Part C: `lite` free, `starter` KES 250, `pro` KES 2,500, `enterprise` KES 10,000 per month; `tenants.plan` links to `plans.key`.

### D.1 IntaSend facts (from developers.intasend.com, checked 2026-10-07)

- Base URL: `https://api.intasend.com/api/v1/` is the same for sandbox and live. The key decides the environment: `_test_` keys run on sandbox, `_live_` keys run on live (https://developers.intasend.com/getting-started/). Sandbox dashboard: sandbox.intasend.com (verify in docs).
- Keys: publishable key `ISPubKey_test_…` / `ISPubKey_live_…` (client-safe: checkout and payment status only). Secret key `ISSecretKey_test_…` / `ISSecretKey_live_…` is **server-only** and is sent as `Authorization: Bearer <secret>`.
- STK push: `POST /api/v1/payment/mpesa-stk-push/` with body `{ amount, phone_number, api_ref }`. Optional fields: `wallet_id` and `mobile_tarrif` (`BUSINESS-PAYS` | `CUSTOMER-PAYS`). Amounts are KES and get rounded up to whole shillings. The response has `invoice.invoice_id`, `invoice.state` (initially `PENDING`) and `invoice.api_ref` (https://developers.intasend.com/guides/collections/mpesa-stk-push/). The Node SDK `intasend-node` has `collection().mpesaStkPush({...})`, and its constructor takes a test flag.
- Status: `POST /api/v1/payment/status/` with `{ invoice_id }`. It accepts the secret or the publishable key. States: `PENDING`, `PROCESSING`, `RETRY`, `PARTIAL`, `COMPLETE`, `FAILED`, `CANCELED`. Useful fields: `value`, `net_amount`, `charges`, `currency`, `account`, `api_ref`, `provider_ref` (M-Pesa receipt), `failed_reason`, `failed_code` (1032 cancelled, 1037 unreachable, 1 insufficient funds, 2001 wrong PIN) (https://developers.intasend.com/guides/collections/overview/).
- Webhooks: you configure them in the dashboard with an HTTPS URL plus a challenge string you choose. The payload carries `topic` (`collection_event` for payments) and `challenge`. Rules: reject the request if the challenge does not match (constant-time compare), return 200/201 fast, process idempotently on `invoice_id` + `state`, and re-confirm critical events through the status API. If more than 20 consecutive deliveries fail, the webhook is deactivated (https://developers.intasend.com/guides/webhooks/, https://developers.intasend.com/docs/setup).
- Payouts: the Send Money API flow is `POST /api/v1/send-money/initiate/`, then `/approve/` (or `requires_approval: "NO"`), with status via `/send-money/status/` `{ tracking_id }` (https://developers.intasend.com/guides/send-money/overview/). **FaidaFleet does not implement payouts.** Ian withdraws or settles to his M-Pesa from the IntaSend dashboard.

### D.2 Environment variables (`.env.example` only; never commit real values)

```
INTASEND_PUBLISHABLE_KEY=ISPubKey_test_xxx   # may be exposed if needed for client status polling; prefer server polling
INTASEND_SECRET_KEY=ISSecretKey_test_xxx     # SERVER ONLY: never prefix with NEXT_PUBLIC_/VITE_, never log
INTASEND_WEBHOOK_CHALLENGE=change-me         # same string as entered in IntaSend dashboard webhook
INTASEND_ENV=sandbox                         # sandbox | live (sanity check: must match key prefix _test_/_live_; refuse to start on mismatch)
```

### D.3 Migration `009_subscriptions_payments.sql`

- `subscriptions`: `id uuid pk`, `tenant_id uuid unique fk tenants on delete cascade`, `plan_key text fk plans(key)`, `status text check in ('active','past_due','expired','canceled')`, `current_period_start timestamptz`, `current_period_end timestamptz`, `grace_until timestamptz null`, `created_at`, `updated_at`.
- `payments`: `id uuid pk`, `tenant_id fk`, `plan_key fk plans(key)`, `amount_kes integer not null check (amount_kes > 0)`, `phone text` (normalised 2547/2541…), `api_ref text unique not null` (generated server-side, e.g. `ff_<payment uuid>`), `intasend_invoice_id text unique null`, `state text default 'PENDING'` (mirrors IntaSend states), `failed_reason text`, `failed_code text`, `provider_ref text` (M-Pesa receipt), `raw_payload jsonb` (last webhook/status body, with no secrets and challenge removed), `initiated_by uuid` (auth user), `created_at`, `updated_at`, `completed_at`. Index on `(tenant_id, created_at desc)`.
- RLS is enabled on both tables. SELECT is allowed for the tenant owner on their own `tenant_id` (reuse the Part A/B owner helper) and for admins on all rows (reuse the Part A `is_admin()` helper). **No INSERT/UPDATE/DELETE policies** for `anon`/`authenticated`: writes happen only from server code using the service role.
- An `updated_at` trigger. Optional: backfill an `active` lite subscription for existing tenants.

### D.4 Start checkout (server route/action, e.g. `POST /api/billing/checkout`)

1. Require an authenticated tenant owner. The input is `{ plan_key, phone }` only; **any amount sent by the client is ignored**.
2. Load the plan from `plans` in the DB. If the plan is unknown or inactive, return 400. If `price_kes = 0` (lite), skip IntaSend and set `tenants.plan` plus the subscription directly (a downgrade takes effect at period end, or immediately if that is simpler; document whichever is chosen).
3. Normalise the phone: strip spaces, `+` and `-`. `07XXXXXXXX`/`01XXXXXXXX` become `2547…`/`2541…`, `7XXXXXXXX` becomes `2547…`, and `2547…`/`2541…` stay as they are. Then validate against `^254(7|1)\d{8}$` and reject anything else.
4. Insert a `payments` row (`PENDING`, with the generated `api_ref`), call `POST /payment/mpesa-stk-push/` with the secret key, store `invoice.invoice_id`, and return `{ payment_id }`. If IntaSend errors, mark the row `FAILED` and return a friendly error. Rate-limit to 1 pending payment per tenant per ~2 minutes.

### D.5 Webhook route (`POST /api/billing/intasend/webhook`, public, no auth cookie)

- Compare `body.challenge` with `INTASEND_WEBHOOK_CHALLENGE` in constant time. On mismatch return 401 and log nothing sensitive.
- Ignore any `topic` other than `collection_event` (return 200). Find the payment by `invoice_id`, falling back to `api_ref`. If neither matches, return 200 and log.
- Idempotency: if the payment is already `COMPLETE`, or the incoming state equals the stored state, return 200 without changes. Use a single transaction / SQL function (`security definer`, service role only) for the state change plus subscription update.
- On `COMPLETE`: re-confirm with `POST /payment/status/` and check that `value` ≥ `amount_kes` and the currency is KES. Then set `completed_at` and `provider_ref`, upsert the subscription to `active` with this plan, and extend the period: if it is still active and on the same plan, `end = current_period_end + 1 month`, otherwise `start = now(), end = now() + 1 month`. Set `tenants.plan = plan_key` and clear `grace_until`.
- On `FAILED`/`CANCELED`: store `failed_reason`/`failed_code` and leave the subscription alone. Always return 200 quickly.

### D.6 Status polling UI

- `GET /api/billing/payments/:id` (owner-only) returns the DB state. If it has been `PENDING`/`PROCESSING` for more than about 20 s, the server may call `/payment/status/` itself and apply the same idempotent update as the webhook.
- The upgrade page shows plan cards with DB prices and a phone input pre-filled from the profile. After submitting, it shows "Check your phone and enter your M-Pesa PIN" and polls every 3 s for up to about 2 min.
- States shown: **pending** (spinner), **success** (new plan plus period end, then refresh the session/plan), **failed** (a reason mapped from `failed_code`, e.g. 1032 "You cancelled the prompt", plus a Retry button). After a timeout the UI says "Still waiting; we'll update once M-Pesa confirms".

### D.7 Renewal and expiry

- There is no auto-debit. Renewal is a new STK push started by the owner ("Renew" button).
- A daily job (Supabase pg_cron or a scheduled edge function; verify availability): when `current_period_end < now()` and the subscription is active, set `status = 'past_due'` and `grace_until = current_period_end + 3 days`. When `grace_until < now()`, set `status = 'expired'` and `tenants.plan = 'lite'`. Data is kept; only the limits change.
- Optional: an in-app banner and email reminder 3 days before `current_period_end` and during the grace period.

### D.8 Admin billing page (`/admin/billing`, admins only)

- A table of real `payments` rows (tenant, plan, KES amount, masked phone `2547****5678`, state, M-Pesa receipt, invoice id, created/completed time in EAT) with filters by state, plan and date. Totals: collected this month (COMPLETE only) and counts by state.
- A subscriptions list (tenant, plan, status, period end, grace). Read-only: there are no payment edits in the UI. No mock data.

### D.9 Service worker / PWA

- Never cache `/api/billing/*`, the webhook route, or the checkout/status pages' API calls. Use NetworkOnly for them, exclude them from precache and runtime caching, and do not queue them for background sync. Never cache responses that contain payment data.

### D.10 Sandbox testing

1. Put the sandbox (`_test_`) keys in `.env.local` with `INTASEND_ENV=sandbox`.
2. Expose the local webhook over HTTPS (e.g. ngrok/cloudflared tunnel or a Vercel preview URL) and register it in the sandbox dashboard under Webhooks with the challenge.
3. Upgrade a test tenant to starter with a test phone (see the sandbox test numbers in the IntaSend docs; verify in docs). Confirm the payment goes PENDING → COMPLETE, the subscription becomes active, and `tenants.plan = starter`.
4. Cancel or fail a payment and check that the UI shows failed and the plan is unchanged.
5. Replay the same webhook and confirm the period is not extended twice. Send a wrong challenge and confirm a 401.
6. Tamper with the client amount and confirm the DB price is still charged.
7. Move `current_period_end` into the past on a test row and run the job: it should become past_due, then expired, then lite.

### D.11 Ian's manual setup

1. Create an IntaSend business account (https://intasend.com) plus a sandbox account (https://developers.intasend.com/getting-started/).
2. Complete KYC/business verification on the live account; live collection and withdrawals need approval.
3. Copy the sandbox keys (Settings → API Keys) into local/Vercel env vars. Swap in the live keys plus `INTASEND_ENV=live` after testing.
4. In the dashboard under Webhooks, set the URL to `https://<prod-domain>/api/billing/intasend/webhook`, choose a long random challenge, put the same string in `INTASEND_WEBHOOK_CHALLENGE`, and subscribe to collection events (https://developers.intasend.com/docs/setup).
5. Set up settlement/withdrawal from the IntaSend wallet to his own M-Pesa number in the dashboard (manual or scheduled withdrawal; verify the options in the dashboard/docs). FaidaFleet code does not do payouts.
6. Apply `009_subscriptions_payments.sql` to Supabase.

### D.12 Acceptance criteria

- [ ] `.env.example` has the 4 IntaSend vars. The secret never reaches the client bundle (grep the build output) or the logs.
- [ ] The migration creates `subscriptions` and `payments` with RLS: owners read their own rows, admins read all, and authenticated clients cannot insert or update.
- [ ] Upgrading to starter/pro/enterprise triggers an STK push for the DB price. Lite needs no payment.
- [ ] Invalid phones are rejected. Valid formats normalise to `2547…`/`2541…`.
- [ ] The webhook rejects a bad challenge, is idempotent, re-confirms via the status API, and activates/extends the subscription and `tenants.plan`.
- [ ] The UI shows pending/success/failed with clear messages.
- [ ] Expiry goes to past_due, then grace (3 days), then expired with downgrade to lite.
- [ ] `/admin/billing` lists real payments and subscriptions, admin-only.
- [ ] Billing routes are excluded from the service worker cache.
- [ ] The sandbox test steps in D.10 pass end to end.
