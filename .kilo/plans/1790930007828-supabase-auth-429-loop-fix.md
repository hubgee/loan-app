# Fix Supabase Auth 429 / redirect-to-login loop (production, Vercel)

## Context — corrected diagnosis

Observed: on Vercel, `/dashboard` **renders successfully**, then the session dies,
a `429` appears on `POST /auth/v1/token?grant_type=refresh_token`, and the app
redirects to `/admin/login`. `grant_type=password` is **not** implicated, which
rules out the sign-in lockout path.

Confirmed by reading every auth-touching file:

- `createClient()` is a module-scope singleton (`src/api/supabaseClient.js:10`).
  Never called in a component body or hook body.
- **No `setInterval` anywhere in `src/`.** No custom refresh timer exists.
- `loadProfile` is a `useCallback` with `[]` deps (`src/auth/AuthContext.jsx:31`),
  so the auth effect's dep array (`[loadProfile]`) is stable. No re-subscribe loop.
- `refresh()` is only called from a manual button (`src/pages/PendingActivation.jsx:37`).
- No query-amplification loop: `UserManagement.jsx:26` uses `[]` deps,
  `Dashboard.jsx:59` and `UserDashboard.jsx:46` use stable scalar deps,
  and `LoanTracker.jsx` has no effects.
- No redirect loop exists between `/dashboard` and `/admin/login`.
  `AdminLogin` never redirects on mount; `vercel.json` is a standard SPA fallback.

**Because the dashboard renders first, the session is valid at load.** This
directly contradicts my earlier hypothesis that the 8s `getSession()` timeout
was the cause — that path cannot fire when the session already works. Do not
treat D1 below as the primary fix.

### The mechanism that sustains it

1. Dashboard renders; token valid; guard passes.
2. A refresh is attempted and fails with `429`.
3. supabase-js treats a failed refresh as fatal — it removes the stored session
   and emits `SIGNED_OUT`.
4. The handler at `src/auth/AuthContext.jsx:114` sets `user` to `null`.
5. `src/components/ProtectedRoute.jsx:20` redirects to `/admin/login`.
6. Re-authenticating starts a new refresh, which is still rate-limited → 429.

**Step 5 is the load-bearing defect.** The redirect on a *failed refresh* is
what converts a recoverable rate limit into a logout loop.

Critically: **a failed refresh leaves the expired token in storage.** Every later
`supabase.auth.getSession()` — including the SDK's own auto-refresh ticker and
every PostgREST query, which resolves its token through `getSession()` — then
re-attempts the refresh and re-429s. That converts one failure into sustained
traffic, which matches "continuous traffic" better than anything in this repo.

### Honest limitation

This repo cannot explain ~30 refreshes/hour from one tab. Something outside the
audited code generates the volume. Task 1 must run first, because the volume
source determines whether the rest of this plan is sufficient.

## Tasks

### 1. Identify the source of the refresh volume (do this FIRST)

Nothing else in this plan is verifiable until this is known.

- Supabase Dashboard → **Authentication → Logs**, filtered to
  `grant_type=refresh_token`. Check the request count per hour and whether
  entries show more than one distinct session for the same admin email.
- Browser DevTools → Network → filter `token` → tick **Preserve log** → reload
  `/dashboard` once → wait ~3 minutes without interacting. Count refresh
  requests and note the gap between them.
  - **Many requests on a fixed short interval with no interaction** → the SDK's
    `autoRefreshToken` ticker is retrying in a loop against a persistently
    expired token. Task 3 addresses this.
  - **Requests only on navigation/reload** → the volume is cumulative across
    page loads. Task 4 plus the operational note below is the fix.
  - **Multiple distinct session references for one email** → more than one client
    or tab is refreshing. Reconsider Task 5.

Record the finding in the PR description.

### 2. Add `authError`; never redirect on a refresh *failure*

`src/auth/AuthContext.jsx`

- Add `authError` state (`null | string`). Set it when session init or a refresh
  fails; clear it on successful init, on `login()`, and on `logout()`.
- Detect rate limiting: `error.status === 429 ||
  /too many requests|rate limit/i.test(error.message)`, and prefer a message
  like "Too many attempts. Wait a moment and retry."
- **Never** null out `user`/`profile` as part of recording a refresh failure.

`src/components/ProtectedRoute.jsx`

- Add the branch **after** `loading` and **before** the `!user` redirect:

  ```jsx
  if (!user && authError) return <SessionRetryScreen onRetry={retryAuth} message={authError} />;
  ```

  Order matters — this is the entire point of the fix. If `!user` is evaluated
  first, the redirect still fires and nothing is fixed.
- Render a "Session check failed" panel with a **Retry** button. Do not redirect
  to `loginRedirect`.
- Gate on `!user &&` so a `fetchProfile` failure (which sets `authError` while the
  session is still valid) renders children instead of blocking a valid session.
- Add `retryAuth` to the context: clears `authError`, sets `loading=true`,
  re-runs init. Must be safe to call repeatedly.

### 3. Stop the retry amplification

`src/api/supabaseClient.js`

- Set `autoRefreshToken: false` on `createClient()`. This disables the SDK's
  internal ticker, so a failed refresh can no longer storm on a timer. Nothing
  else in the options changes; do **not** add an `accessToken` option (see the
  comment at `supabaseClient.js:6` — it disables `signInWithPassword`/`signUp`/
  `signOut`).

`src/auth/AuthContext.jsx`

- Own the refresh explicitly instead, via a module-level single-flight so
  concurrent callers share one in-flight request:

  ```js
  let sessionPromise = null;
  const getSessionOnce = () => {
    if (!sessionPromise) {
      const p = supabase.auth.getSession();
      sessionPromise = p;
      p.finally(() => { if (sessionPromise === p) sessionPromise = null; })
       .catch(() => {});            // the real await handles the rejection
    }
    return sessionPromise;
  };
  ```

  Clear the cached promise when it **settles**, with the identity guard above, so
  a `Retry` after failure genuinely re-issues. Without that guard a slow promise
  could null out a newer one and freeze auth at its initial state.
- Add a **cooldown circuit breaker**: after a failed refresh, suppress further
  refresh attempts for 60s and surface `authError` during the window. This is
  what guarantees the 429 stops compounding regardless of Task 1's finding.

### 4. Remove the `getSession()` timeout and fix the cleanup race

`src/auth/AuthContext.jsx`

- Remove `withTimeout` from the `getSession()` await; await `getSessionOnce()`
  directly. Never resolve init with `session = null` because of slowness.
  (Not your primary symptom, but a real false-sign-out path and cheap to remove.)
- Assign the subscription to a ref **as soon as it is created**, not only at the
  end of `setup()`. The current cleanup at `AuthContext.jsx:133` runs before
  `unsubscribe` is assigned, so the listener is never unsubscribed and can still
  call `setState`. Re-check `mounted` immediately before registering.
- Keep `withTimeout` on `fetchProfile` (12s), `bootstrap_admin_profile` (8s), and
  `signOut` (8s). None touch session tokens.
- Do not change the `onAuthStateChange` session logic. It already defers the
  profile read with `setTimeout(..., 0)` to escape the SDK auth lock, and
  `profileTicket` already drops stale reads. One `TOKEN_REFRESHED` per genuine
  refresh is not a loop.

### 5. Cross-tab — hold until Task 1 reports

A shared promise only dedupes within one JS realm. Two tabs each run their own
ticker against one `localStorage` refresh token, which is both a rate-limit
multiplier and a reuse-detection trigger. If Task 1 shows multiple sessions per
email, add a `BroadcastChannel` (or `storage`-event) listener so one tab owns the
refresh. Do not build this speculatively.

## Risks

- **`authError` masking a real revocation.** A revoked or reused session fails
  with a *null session and no error*, so it still reaches the normal redirect.
  Only an actual error response sets `authError`. Verify on a genuine sign-out.
- **`autoRefreshToken: false` means we now own refresh timing.** If `getSessionOnce()`
  is not called on every path that needs a valid token, long-lived tabs may go
  stale. `getSession()` still refreshes an expired token on demand; the cooldown
  is the only intentional suppression.
- **Cooldown suppresses genuine recovery.** A 60s wait after a transient network
  error is a deliberate tradeoff. The Retry button bypasses it.
- **`loadProfile` timeout bounce (pre-existing, out of scope).** If the 12s
  `fetchProfile` timeout trips, `profile` is `null`, so `isAdmin` is false and
  `ProtectedRoute.jsx:26` sends an admin to `/loans`. Distinct bug; do not
  expand this change to cover it.

## Validation

1. `npm run lint` and `npm run build` pass.
2. **429 loop broken.** Trigger the failure, then confirm `/dashboard` shows the
   "Session check failed" retry screen and the URL **does not** become
   `/admin/login`.
3. **Retry works.** Click Retry, confirm recovery without a manual reload.
4. **Traffic actually drops.** Repeat the Task 1 Network measurement after the
   fix. Refresh requests while idle must go to zero.
5. **Genuine sign-out still works.** Log out via the navbar; confirm a redirect
   to `/admin/login` (a null session with no error must still redirect).
6. **Non-admin path unaffected.** Log in as a borrower; confirm `/dashboard`
   still redirects to `/loans` and the `/pending` activation check still works.
7. **No leaked listener.** After repeated reloads, confirm no orphaned
   `onAuthStateChange` subscription retains state.

## Known limitation

If Task 1 shows the volume comes from multiple tabs or clients, this plan will
reduce but not eliminate it — Task 5 must then be implemented. Operational
mitigation in the meantime: sign out fully before closing the admin session, and
avoid leaving `/dashboard` open in more than one tab.