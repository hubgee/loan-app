# Kuwala Loans

A Vite + React SPA served as static files by Vercel. Supabase **is** the
backend: GoTrue Auth, Postgres, RLS and Storage. There is no application
server — the browser talks to Supabase directly through `@supabase/supabase-js`,
and RLS is the security boundary.

## Layout

```
src/
  api/supabaseClient.js   Supabase singleton
  auth/AuthContext.jsx    auth state machine (status/user/profile/authError)
  auth/authDebug.js       opt-in VITE_AUTH_DEBUG logger
  components/ProtectedRoute.jsx   route guard
  pages/                  Landing, Login, Signup, PendingActivation,
                          Dashboard (admin), UserManagement (admin),
                          UserDashboard (borrower)
supabase/
  schema.sql              destructive, re-runnable; drop + recreate
  seed-admin.sql          run once, by hand, to promote one admin
```

## Setup

### 1. Supabase

1. Authentication → Settings → enable **Auto Confirm User** so signups get a
   session immediately and land on `/pending`.
2. Run `supabase/schema.sql` in the SQL Editor. It drops and recreates every
   table, function, trigger and policy the app owns — **it is destructive by
   design and safe to re-run.** There is no data migration; borrowers must
   re-signup.
3. Sign up the admin account through the app (`/signup`), then run
   `supabase/seed-admin.sql` with that email substituted in. Admin is never
   granted at login; there is no `app_settings` table and no client-callable
   promotion RPC.

### 2. Environment variables

| Name                   | Value                                  |
| ---------------------- | -------------------------------------- |
| `VITE_SUPABASE_URL`    | `https://your-project.supabase.co`     |
| `VITE_SUPABASE_ANON_KEY` | the anon **public** key              |
| `VITE_AUTH_DEBUG`      | `true` to log auth events (optional)    |

Vite inlines `VITE_*` at **build** time. Changing a value in the Vercel
dashboard requires a **redeploy**; saving alone does nothing.

### 3. Vercel

Import the repo. `vercel.json` sets Framework Preset Vite, build command
`npm run build`, output directory `dist`, and rewrites all routes to
`/index.html` so hard refreshes on client-side routes resolve.

Set the environment variables above for **Production**, then deploy.

## Roles

- Every signup gets `public.profiles` row `(role = 'borrower', is_active = false)`
  via the `on_auth_user_created` trigger. Inactive borrowers can only reach
  `/pending`.
- An admin activates borrowers in `/admin/users`, which writes
  `public.profiles.is_active` through the `admin_users()` RPC for listing
  (it joins `auth.users` for the email) and the RLS update policy for the write.
- Role and activation are properties the account *has*. They are never mutated
  by client code at login.

## Loan statuses

Lowercase: `pending`, `approved`, `repaid`.

## Auth model

`AuthContext` exposes an explicit state machine — `status` is one of
`initializing`, `authenticated`, `anonymous`, `error`.

`error` is **not** `anonymous`. A rate-limited or slow token refresh sets
`authError` and leaves the session intact; `ProtectedRoute` renders
`SessionRetryScreen` (message + Retry) for `error`, and only redirects to the
login form for `anonymous`. This is deliberate: converting a recoverable 429
into a sign-out costs more auth quota and produces a self-sustaining logout
loop.

With `VITE_AUTH_DEBUG=true`, the console logs every auth event with a
timestamp, the access token's `exp`, the gap between refresh attempts, and the
status/message of any failure. Tokens are never logged.