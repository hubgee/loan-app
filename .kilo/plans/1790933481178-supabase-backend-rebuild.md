# Rebuild the Supabase backend + auth layer (Vercel static + Supabase, no local runtime)

## Target architecture (decided)

**Vercel serves a static Vite bundle. Supabase is the entire backend: GoTrue Auth +
Postgres + RLS + Storage. There is no application server.**

The frontend talks to Supabase directly via `supabase-js`. RLS is the security
boundary, enforced in Postgres regardless of what the client does. This is the
only architecture that satisfies "deploy to Vercel + Supabase" without adding a
second runtime to debug. Explicitly **not** doing:

- **No Supabase Edge Functions.** The current bug is a subtle session/token
  lifecycle defect. Adding a Deno runtime on top would add a third moving part
  before the current two are known to work.
- **No `backend/` server.** The existing `backend/` folder is a stock Laravel
  skeleton (`README.md`, `composer.json`, `vite.config.js`). Nothing imports it
  and Vercel never builds it.

## Diagnosis this plan is built on

**Do not skip Task 1. The schema rewrite cannot fix the reported symptom.**

The 429 is on `POST /auth/v1/token?grant_type=refresh_token`. That request is
rated by the Supabase **Auth API rate limiter**. Nothing in SQL — tables, RLS
policies, triggers, RPCs — influences it. A perfect schema would still 429.

The self-sustaining loop, now fully traced:

1. Admin logs in at `/admin/login`. `supabase-js` persists the session and starts
   its 30s auto-refresh ticker (`autoRefreshToken` defaults to `true`).
2. One refresh attempt is slow or degraded. The SDK retries on the 30s tick.
3. Project auth quota is exhausted. The refresh returns **429**.
4. `supabase-js` treats a failed refresh as fatal: it deletes the stored session
   and emits `SIGNED_OUT`.
5. `AuthContext.jsx:112` runs `setUser(null)` **unconditionally** — it cannot
   distinguish "signed out by the user" from "refresh failed".
6. `ProtectedRoute.jsx:20` sees `!user` and redirects to `/admin/login`.
7. The admin logs in again, consuming more auth quota. **Deeper into the limit.**

That is why the dashboard renders first and *then* bounces, and why it repeats.
Step 5 is the load-bearing defect: a recoverable rate limit is converted into a
logout, and the logout costs more quota, which deepens the rate limit.

The rebuild's primary job is to make **step 5 impossible** — not to change tables.

### Corrections to the previous plan (`1790930007828-supabase-auth-429-loop-fix.md`)

Deliberate disagreements. Do not carry these forward:

- ~~Set `autoRefreshToken: false`.~~ **Wrong for this app.** With it off,
  nothing refreshes a long-lived admin tab, `getSession()` starts handing out an
  expired access token, and every query 401s. Keep the SDK default. The ticker
  is not the bug; destroying the session on failure is.
- ~~Keep the `getSession()` 8s `withTimeout`.~~ **This is a live false-sign-out
  path.** `withTimeout` rejects on slowness, `session` stays `null`, and
  `loadProfile(null)` nulls the user. On a cold Vercel start under load this
  alone produces the exact reported symptom. All auth timeouts are removed.
- ~~Keep `profileTicket`.~~ It exists to paper over the race between the
  `SIGNED_IN` handler's profile read and `login()`'s bootstrap read. Removing
  the login-time bootstrap RPC removes the race, so the ticket goes too.

## Confirmed-safe to delete

- `backend/` — entire folder, dead Laravel skeleton.
- `axios` from `package.json` — no import anywhere in `src/`.
- `public.app_settings` table and the `bootstrap_admin_profile` RPC — see Task 2.
- `src/api/supabaseClient.js:14-15` — the legacy metadata-based `isAdmin`
  helper. Unused, and it reads role from `user_metadata`, which is client-writable.
  Role must come from the DB.

## Constraints

- **The live Supabase project has no real data and may be wiped.** The schema in
  Task 2 is destructive by design. Re-running it is expected and safe.
- Everything is validated against the **deployed Vercel URL**, not localhost.
  Localhost is not a deployment target here.
- Vite inlines `VITE_*` **at build time**. Changing a Supabase env var on Vercel
  requires a **redeploy**; saving it is not enough. Task 1 depends on this.

## Tasks

### 1. Gate on the real cause before touching code (do this FIRST)

The rebuild is worth doing, but it is not proven to fix the 429. Cheap checks
first; each can end the investigation on its own.

1. **Vercel env vars.** Project → Settings → Environment Variables. Confirm
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist for **Production**.
   If Production was never populated, `createClient(undefined, undefined)` throws
   at module load and nothing auth-related works at all — a far simpler
   explanation than every hypothesis above. If they were recently changed,
   **redeploy**; the old build still has the old values baked in.
2. **Supabase Auth Logs.** Dashboard → Authentication → Logs, filter
   `grant_type=refresh_token`. Note requests/hour and whether one admin email
   shows multiple distinct session references.
3. **DevTools on the deployed URL.** Network → filter `token` → enable
   **Preserve log** → load `/admin/login`, sign in, then idle ~3 minutes without
   clicking. Count refresh requests and the gap between them.
   - Fixed short interval (~30s) with no interaction → the SDK ticker retrying
     against a dead refresh token. Task 3 addresses it.
   - Only on navigation/reload → volume is cumulative across page loads.
   - Multiple distinct sessions per email → more than one tab is refreshing.

Record the outcome in the PR description. **If step 1 turns out to be the whole
problem, stop here** — do not rewrite a backend that was never broken.

### 2. Rewrite the schema (`supabase/schema.sql`)

Destructive, re-runnable from scratch. Run in Supabase Dashboard → SQL Editor.

**Drop everything first, in dependency order:**

```sql
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.bootstrap_admin_profile();
drop function if exists public.handle_new_user();
drop function if exists public.is_admin();
drop function if exists public.is_active_user();
drop table if exists public.loan_applications cascade;
drop table if exists public.profiles cascade;
drop table if exists public.app_settings cascade;
drop policy if exists "Borrowers can upload own ids" on storage.objects;
drop policy if exists "Admins can read ids" on storage.objects;
```

**`public.profiles`** — renamed from `users` so it is not confused with
`auth.users`. Dropping the redundant `email` column removes a drift source;
the UI already reads `user.email` off the auth session.

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'borrower' check (role in ('borrower','admin')),
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**`public.loan_applications`** — keep the column set the UI already reads
(`Dashboard.jsx:21-39`, `LoanForm.jsx`). Add `updated_at`, which the app
currently lacks entirely, so a status change is auditable. Change
`status` to lowercase (`pending`/`approved`/`repaid`) to match `role`, and
update `Dashboard.jsx:41-47` and `LoanTracker.jsx` accordingly.

**`public.is_admin()` / `public.is_active_user()`** — keep these as
`SECURITY DEFINER` functions. This is **not** cargo-culted: an inline
`exists (select 1 from public.users ...)` written *on* `public.users` re-enters
that table's own RLS mid-evaluation and Postgres raises
`infinite recursion detected in policy for relation users`. The function form is
the correct fix and must survive the rewrite.

Fix the over-grant that exists today (`schema.sql:51-52` and `:205` grant to
`anon`, which has no business calling these):

```sql
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_active_user() from public;
revoke execute on function public.bootstrap_admin_profile() from public;  -- dropped, belt-and-braces
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
```

**Signup trigger** — same behaviour, `borrower` / `is_active = false`.

**No login-time admin promotion.** This is the core design change. There is no
`app_settings` table and no `bootstrap_admin_profile` RPC. Admin is a property
the account *has*, set once by SQL, never granted by the client at login. The
current design lets every login mutate a row via a `SECURITY DEFINER` function
reachable from the browser — that is the thing that "got mixed up".

New file `supabase/seed-admin.sql`, run once by hand:

```sql
update public.profiles set role = 'admin', is_active = true
where id = (select id from auth.users where email = 'ADMIN_EMAIL_HERE');
```

**RLS** — recreate all four `loan_applications` policies and the two
`profiles` policies exactly as they are today, plus the `storage.objects`
policies for the `ids` bucket. Only the function-grant list changes. Keep the
existing note at `schema.sql:252-255`: do **not** run
`alter table storage.objects enable row level security` (ERROR 42501 on free).

### 3. Rewrite `src/auth/AuthContext.jsx`

Replace the three stacked patches with an explicit state machine. This is the
file that actually causes the reported symptom.

- **State:** `status: "initializing" | "authenticated" | "anonymous" | "error"`,
  plus `user`, `profile`, `authError`. One `isInitializing` replaces the
  overloaded `loading` so "still working" and "gave up" are distinguishable.
- **Delete `withTimeout` entirely** (`AuthContext.jsx:9-15`). No timeout on
  `getSession()`. A slow response is slow, not signed out. This is the single
  most likely source of the false redirect.
- **Delete `profileTicket`** (`AuthContext.jsx:26`). Its only purpose was
  resolving the race with `login()`'s bootstrap read, which Task 2 removes.
- **Register `onAuthStateChange` synchronously in the effect body**, before any
  `await`. Assign the unsubscribe function immediately. The current code
  registers it at `AuthContext.jsx:107` — after two awaits — while the cleanup
  at `:133` reads an `unsubscribe` that is still `undefined`, so the listener is
  never removed and keeps calling `setState` after unmount.
- **Session and profile are read once, in one place.** `getSession()` →
  `profiles` read → set state. `TOKEN_REFRESHED` must **not** re-read the
  profile; the role and activation state cannot change from a token refresh.
  This alone removes the per-refresh database query.
- **Never null the session because of an error.** Set `authError` and
  `status: "error"`, and leave `user`/`profile` alone. A 429 on refresh must not
  log anyone out. Detect it with
  `error.status === 429 || /too many requests|rate limit/i.test(error.message)`.
- **Only three things may set `status: "anonymous"`:** an `INITIAL_SESSION`
  event with a null session, an explicit `SIGNED_OUT` event, and a successful
  `signOut()`.
- **Delete `login()`'s RPC block** (`AuthContext.jsx:146-168`). Login becomes
  `signInWithPassword` → one profile read → done. `login()` returns
  `{ user, profile }` as before so `AdminLogin.jsx:20` keeps working.
- **`refresh()`** (`AuthContext.jsx:206-211`) re-reads the profile via
  `getUser()`; keep, so the `/pending` "I've been activated" button still works.

### 4. Rewrite `src/components/ProtectedRoute.jsx`

Branch order is the entire fix:

```jsx
if (status === "initializing") return <FullPageSpinner />;
if (status === "error")      return <SessionRetryScreen message={authError} onRetry={retryAuth} />;
if (status === "anonymous")  return <Navigate to={loginRedirect} replace />;
```

The `error` branch sits **above** `anonymous`. If `anonymous` is evaluated first
the redirect still fires and nothing is fixed. The retry screen shows the error
message and a Retry button, and does **not** navigate.

`role` handling and `requireActive` stay as they are (`ProtectedRoute.jsx:24-36`),
including the `/loans` vs `/pending` routing.

### 5. Clean up and verify the deployment

- Delete `backend/` entirely. Remove `axios` from `package.json`.
- Trim `src/api/supabaseClient.js` to the client and the two-line comment about
  `accessToken` (which genuinely does break `signInWithPassword`/`signUp`/
  `signOut`). Keep `autoRefreshToken` at its default — do **not** add the option.
  Add `persistSession: true` explicitly only if it aids clarity.
- `vercel.json`: rewrite destination is `/index` (`vercel.json:8`). With
  `cleanUrls: true` this resolves, but `/index.html` is the documented form and
  removes the ambiguity. Verify a hard refresh on `/dashboard` and
  `/admin/login` returns the app shell, not a 404.
- Update the setup comments at the bottom of `schema.sql` — remove the
  `app_settings` insert instruction, point at `seed-admin.sql`, and state that
  Vercel env vars are build-time and require a redeploy.

### 6. Instrument so this cannot silently regress

Add an opt-in auth debug logger behind `import.meta.env.VITE_AUTH_DEBUG`. When
on, log: auth events with timestamps, access-token `exp`, time between refresh
attempts, and the status/message of every failed refresh. This is what makes
the Task 1 measurement repeatable from the deployed URL without DevTools
spelunking. It must be a no-op when the flag is unset, and must never log
tokens — only `exp` and error status/message.

## Risks

- **The rebuild may not fix the 429.** Stated plainly: SQL changes cannot alter
  the Auth rate limiter. Task 1 exists to prevent a rewrite that cannot work.
  If Task 1 step 1 finds missing Vercel env vars, that is the bug and Tasks
  2-6 are optional hardening.
- **Leaving the session alive on a refresh failure** means an admin whose token
  is genuinely dead sees a retry screen instead of a login form. That is the
  intended trade: a wasted click beats a logout loop. A *revoked* session still
  emits `SIGNED_OUT` with no error, so it still reaches the login form normally.
  Verify this on a real sign-out.
- **`status` values change shape.** Every `useAuth()` consumer must be checked:
  `App.jsx`, `ProtectedRoute.jsx`, `PendingActivation.jsx:10`,
  `UserDashboard.jsx`, `UserManagement.jsx`, `Navbar.jsx`, `Dashboard.jsx`,
  `UserDashboard.jsx`. Anything reading `loading` becomes `status ===
  "initializing"`. Missing one reintroduces the "stuck spinner" class of bug.
- **Lowercase `status` on loans** requires coordinated UI edits
  (`Dashboard.jsx:41-47` filters on `'Pending'`/`'Approved'`/`'Repaid'`).
  Miss one and stats silently read zero.
- **Re-running the schema drops all tables.** Acceptable per confirmed scope, but
  every borrower must re-signup, and `seed-admin.sql` must be re-run afterwards
  or no admin exists.

## Validation

All steps run against the **deployed Vercel URL** after a redeploy.

1. `npm run lint` and `npm run build` pass.
2. Admin signs in at `/admin/login`, `/dashboard` renders and **stays** rendered.
   Idle 5 minutes: zero redirects, and with `VITE_AUTH_DEBUG=true` the refresh
   interval is logged and stable.
3. No sign-out during idle. This is the regression this whole plan targets.
4. Force a refresh failure (devtools: throttle to Slow 3G and reload, or
   temporarily block `*/auth/v1/token*` in the Network panel) and confirm the
   **"Session check failed"** retry screen appears and the URL stays
   `/dashboard` — it must not become `/admin/login`.
5. Click Retry and confirm recovery without a manual reload.
6. Genuine sign-out via the navbar still redirects to `/admin/login`.
7. Borrower flow: sign up at `/signup` → lands on `/pending` → cannot reach
   `/apply` while inactive → admin activates in `/admin/users` → the borrower
   clicks "I've been activated" and reaches `/loans` → submits an application →
   it appears in `/dashboard` for the admin.
8. Borrower cannot reach `/dashboard`; non-active borrower cannot reach `/apply`.
9. Hard refresh on `/dashboard`, `/admin/login`, `/loans` all return the app
   shell (verifies `vercel.json`).
10. Re-run the Task 1 DevTools measurement; compare refresh count against the
    pre-fix baseline.