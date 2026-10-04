# Loan Limit Increase Feature — Criteria & Implementation Plan

## Goal

Allow active borrowers to request a loan-limit increase. An admin evaluates the request against a defined set of credit criteria, approves or denies it, and — if approved — the borrower's per-user `loan_limit` is raised. New `loan_applications` are constrained to that limit.

Borrower self-request → admin approves/denies (per user confirmation).

---

## 1. Evaluation Criteria (Industry Standards)

The admin reviews the borrower's record on a single screen. The criteria are grouped
into three risk pillars. For v1 the assessment is **qualitative** — the admin reviews
the data and makes a judgment call logged in `admin_notes`. Structured scoring fields
can be layered on later.

### A. Repayment Performance
1. **On-time repayment rate** — % of completed loans repaid on or before `repayment_date`.
2. **Number of successfully completed loans** — count of `repaid` applications.
3. **Overdue / default count** — `repaid` loans where actual payment exceeded the due date (future), or any `cancelled`/`edit_requested` pattern indicating instability.
4. **Total principal repaid to date** — sum of `amount` across completed loans.
5. **Largest loan successfully repaid** — indicates the borrower can handle higher principal.

### B. Utilization & Behavior
6. **Current limit utilization** — `last_approved_amount / loan_limit` ratio; consistently maxing out the limit signals readiness for an increase.
7. **Loan size trend** — sequence of amounts across completed cycles (upward, flat, or declining).
8. **Repayment velocity** — average days to repay across cycles; faster = lower risk.
9. **Application frequency** — how often the borrower applies after repaying (too soon = churn risk).
10. **Edit / cancel frequency** — high rates of `edit_requested` or `cancelled` indicate planning uncertainty.

### C. Financial Profile & Relationship
11. **Customer tenure** — days since first `loan_applications.created_at` or `profiles.created_at`.
12. **Requested purpose** (optional) — business expansion, emergency, investment, etc. An admin may still approve without a stated purpose; disclosure is at the borrower's discretion.
13. **Stated reason for increase** (optional) — when provided, whether the borrower articulates a specific, measurable need.
14. **Payout method track record** — mobile money (faster, more traceable) vs. bank; history of failed payouts.
15. **National ID on file** — identity verification already collected during first application.

> **Admin decision rule of thumb (microfinance standard):** Approve an increase if
> on-time rate ≥ 85%, ≥ 2 fully-repaid loans, current utilization ≥ 75%, and tenure ≥ 30 days.
> All are necessary; any hard failure (default, excessive cancellations) is cause for
> denial or a smaller increase.

---

## 2. Data Model

### 2.1 `profiles.loan_limit` (new column)

| Column      | Type            | Default   | Notes |
|-------------|-----------------|-----------|-------|
| `loan_limit`| `numeric(12,2)` | `50000`   | Current effective maximum per application. Checked at insert time. |

- `50,000 MWK` is a reasonable microfinance starting ceiling in Malawi. **Adjust to group policy.**
- Add a `CHECK (loan_limit >= 0)` constraint so limits can never go negative.

### 2.2 `limit_increase_requests` (new table)

Append-only request-and-decision log (mirrors the `loan_events` audit pattern).

| Column             | Type             | Notes |
|--------------------|------------------|-------|
| `id`               | `bigint` identity PK | |
| `borrower_id`      | `uuid` → `profiles(id)` ON DELETE CASCADE | |
| `current_limit`    | `numeric(12,2)`  | Snapshot at request time |
| `requested_limit`  | `numeric(12,2)`  | Target total limit the borrower is asking for |
| `reason`           | `text`           | Optional borrower-stated purpose for the increase |
| `status`           | `text` default `pending`, CHECK `('pending','approved','denied')` | |
| `admin_notes`      | `text`           | Qualitative assessment |
| `decided_by`       | `uuid`           | FK to admin profile (no FK — admin role is not guaranteed to persist) |
| `decided_at`       | `timestamptz`    | |
| `created_at`       | `timestamptz`    | default `now()` |
| `updated_at`       | `timestamptz`    | default `now()` |

### 2.3 RLS on `limit_increase_requests`

Borrowed from the existing `loan_events` policy pattern. The requester can only
read their own; admins can read all; only admins can approve/deny.

```sql
-- Borrowers: read own, insert own
create policy "Borrowers can read own limit requests" on public.limit_increase_requests
  for select to authenticated
  using (borrower_id = auth.uid());

create policy "Borrowers can submit own limit requests" on public.limit_increase_requests
  for insert to authenticated
  with check (borrower_id = auth.uid());

-- Admins: read all, approve/deny (update status / admin_notes / decided_*)
create policy "Admins can manage limit requests" on public.limit_increase_requests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
```

---

## 3. Migration (SQL)

**File:** `supabase/migration-loan-limits.sql`

Follow the existing non-destructive pattern (`do $$` + `information_schema.columns` guard).
Safe to re-run.

```sql
-- ============================================================
-- Non-destructive migration: borrower loan-limit increases
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1) loan_limit on profiles (the effective ceiling per borrower)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'loan_limit'
  ) then
    alter table public.profiles
      add column loan_limit numeric(12,2) not null default 50000;
    -- Backfill: every profile gets the default. Adjust 50000 to group policy.
    update public.profiles set loan_limit = 50000;
  end if;
end $$;

-- Guard: limits can never be negative
alter table public.profiles
  add constraint profiles_loan_limit_non_negative check (loan_limit >= 0);

-- 2) limit_increase_requests table (request + decision audit trail)
create table if not exists public.limit_increase_requests (
  id              bigint generated always as identity primary key,
  borrower_id     uuid not null references public.profiles(id) on delete cascade,
  current_limit   numeric(12,2) not null,
  requested_limit numeric(12,2) not null,
  reason          text,
  status          text not null default 'pending'
      check (status in ('pending','approved','denied')),
  admin_notes     text,
  decided_by      uuid,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists limit_increase_requests_borrower_idx
  on public.limit_increase_requests (borrower_id, created_at desc);

create index if not exists limit_increase_requests_status_idx
  on public.limit_increase_requests (status)
  where status = 'pending';

alter table public.limit_increase_requests enable row level security;

-- 3) RLS policies (borrower read-own / self-insert; admin full)
drop policy if exists "Borrowers can read own limit requests" on public.limit_increase_requests;
create policy "Borrowers can read own limit requests"
  on public.limit_increase_requests for select to authenticated
  using (borrower_id = auth.uid());

drop policy if exists "Borrowers can submit own limit requests" on public.limit_increase_requests;
create policy "Borrowers can submit own limit requests"
  on public.limit_increase_requests for insert to authenticated
  with check (borrower_id = auth.uid());

drop policy if exists "Admins can manage limit requests" on public.limit_increase_requests;
create policy "Admins can manage limit requests"
  on public.limit_increase_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4) updated_at trigger for the new table
drop trigger if exists set_limit_increase_requests_updated_at on public.limit_increase_requests;
create trigger set_limit_increase_requests_updated_at
  before update on public.limit_increase_requests
  for each row execute function public.set_updated_at();

-- 5) Enforce limit at the loan_applications insert boundary (defense in depth)
-- Borrower insert policy gains: amount <= the borrower's own loan_limit
drop policy if exists "Borrowers can submit own applications" on public.loan_applications;
create policy "Borrowers can submit own applications"
  on public.loan_applications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and processed_by is null
    and public.is_active_user()
    and amount <= (select loan_limit from public.profiles where id = auth.uid())
  );
```

**Important RLS note (mirrors existing schema):** The subquery `(select loan_limit
from public.profiles where id = auth.uid())` inside the `loan_applications` insert
policy references a *different* table (`profiles`), so there is no recursion risk.
The existing `is_admin()` / `is_active_user()` SECURITY DEFINER functions are still
needed for the policies that query `profiles` *from* the `profiles` table itself.

---

## 4. AuthContext — expose `loan_limit`

`src/auth/AuthContext.jsx:18` currently reads:

```js
const PROFILE_COLUMNS = "id, role, is_active, created_at, updated_at";
```

Add `loan_limit`:

```js
const PROFILE_COLUMNS = "id, role, is_active, loan_limit, created_at, updated_at";
```

This makes `user.profile.loan_limit` available everywhere `useAuth()` is used
(`LoanForm`, `UserDashboard`, `Dashboard`).

---

## 5. API Layer

**File:** `src/api/limitIncreases.js` (new) — mirrors the style of `loanDecisions.js`.

```js
import { supabase } from "./supabaseClient";

// Borrower: fetch own request history (most recent first)
export async function fetchMyLimitRequests() {
  const { data, error } = await supabase
    .from("limit_increase_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Borrower: submit a new request (reason is optional — some borrowers
// may not wish to disclose their purpose)
export async function submitLimitIncreaseRequest({ requestedLimit, reason }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  // Fetch the borrower's current limit to snapshot it in the request row
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("loan_limit")
    .eq("id", user.id)
    .single();
  if (profileErr) throw profileErr;
  const { data, error } = await supabase
    .from("limit_increase_requests")
    .insert({
      borrower_id: user.id,
      current_limit: profile.loan_limit,
      requested_limit: Number(requestedLimit),
      reason: reason?.trim() || null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Admin: fetch all requests via RPC (joins auth.users for email server-side;
// the anon role cannot read auth.users directly from the client)
export async function fetchLimitRequests(status = null) {
  const { data, error } = await supabase.rpc("admin_limit_requests");
  if (error) throw error;
  let rows = data || [];
  if (status) rows = rows.filter((r) => r.status === status);
  return rows;
}

// Admin: approve or deny
export async function decideLimitRequest(requestId, { status, adminNotes, newLimit }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const patch = {
    status,
    admin_notes: adminNotes?.trim() || null,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
  };
  if (status === "approved" && newLimit != null) {
    // Update the borrower's loan_limit
    const { data: request } = await supabase
      .from("limit_increase_requests")
      .select("borrower_id")
      .eq("id", requestId)
      .single();
    if (request) {
      await supabase
        .from("profiles")
        .update({ loan_limit: Number(newLimit) })
        .eq("id", request.borrower_id);
    }
  }
  const { error } = await supabase
    .from("limit_increase_requests")
    .update(patch)
    .eq("id", requestId);
  if (error) throw error;
  return patch;
}
```

> **Borrower email in admin view:** `profiles` has no `email` column. The
> `fetchLimitRequests` helper calls the SECURITY DEFINER RPC `admin_limit_requests()`
> (defined below) which joins `limit_increase_requests` → `profiles` → `auth.users`
> server-side and returns the email, gated on `is_admin()`.

### RPC for admin requests list (SQL)

```sql
create or replace function public.admin_limit_requests()
returns table (
  id              bigint,
  borrower_id     uuid,
  borrower_email  text,
  current_limit   numeric,
  requested_limit numeric,
  reason          text,
  status          text,
  admin_notes     text,
  decided_by      uuid,
  decided_at      timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    r.id,
    r.borrower_id,
    u.email as borrower_email,
    r.current_limit,
    r.requested_limit,
    r.reason,
    r.status,
    r.admin_notes,
    r.decided_by,
    r.decided_at,
    r.created_at,
    r.updated_at
  from public.limit_increase_requests r
  join public.profiles p on p.id = r.borrower_id
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by r.created_at desc
$$;

revoke execute on function public.admin_limit_requests() from public;
grant execute on function public.admin_limit_requests() to authenticated, service_role;
```

The JS helper `fetchLimitRequests` then calls `supabase.rpc("admin_limit_requests")`
instead of the `.from().select()` path.

---

## 6. Frontend Changes

### 6.1 `src/components/LoanForm.jsx`
- Read `loanLimit` from `useAuth()`.
- Show the current limit next to the amount input (e.g. `Limit: Mkw 50,000`).
- Add client-side validation: `if (Number(formData.amount) > loanLimit)` → alert before submission.
- Add a small link below the amount field: **"Need a higher limit? Request an increase"** → opens `LimitIncreaseRequestModal`.
- The existing `purpose` field is already optional (`LoanForm.jsx:265` sets `purpose: formData.purpose || null`) and stays that way — no change needed.

### 6.2 `src/components/LimitIncreaseRequestModal.jsx` (new)
Modal form (styled like `LoanEditModal`):

- Read-only display of `current_limit` (fetched via `fetchCurrentLimit()` or passed as prop).
- Input: `requested_limit` (number) — must be > current_limit and ≤ a sensible max (e.g. 500,000 MWK).
- Textarea: `reason` (optional) — borrower may leave blank to avoid disclosing.
- Submit → `submitLimitIncreaseRequest`, then closes modal, shows confirmation message.
  - Reason is nullable; the DB column is `text` (not `NOT NULL`), so no validation is triggered on an empty reason.

### 6.3 `src/pages/UserDashboard.jsx`
- In the "My Loans" tab (or a new "Limit" section), show: `Current limit: Mwk X` + a "Request increase" button.
- Show the borrower's `pending` request status inline (e.g. `Pending admin review`).
- Pass `loanLimit` down to `LoanForm` or rely on `useAuth()`.

### 6.4 `src/pages/Dashboard.jsx` (admin)
- Add a new tab/section: **Limit Increase Requests** (alongside the loan tracker).
- Load requests via `supabase.rpc("admin_limit_requests")`.
- Show: borrower email, current_limit, requested_limit, reason, status, created_at, admin_notes.
- Pending requests show **Approve / Deny** buttons.
  - Approve opens a small inline note editor: set `new_limit` (default = `requested_limit`, editable), add `admin_notes`, then call `decideLimitRequest(id, "approved", notes, newLimit)`.
  - Deny opens a note editor: call `decideLimitRequest(id, "denied", notes)`.
- After decision, re-fetch the list and refresh `load()` (which already reloads loans).

### 6.5 `src/components/LoanTracker.jsx`
No schema change needed — already generic. But the `updateLoan` and `handleAdminAction` in `Dashboard.jsx` may benefit from also re-fetching limit requests. Keep changes minimal; the new admin section can be a separate `LimitRequestTracker` component or inline in `Dashboard.jsx`.

---

## 7. Operational Workflow

### 7.1 Borrower flow
1. Borrower is active (`is_active = true`) and sees their current `loan_limit` on `/loans`.
2. Borrower clicks "Request limit increase" → modal opens.
3. Borrower enters desired limit and (optionally) a reason → submits.
4. A `limit_increase_requests` row is created with `status = 'pending'`.
   - A banner appears: "Request submitted. Admin will review." 
5. If the admin approves, the borrower's `loan_limit` in `profiles` is updated.
   - They can immediately see the new limit and apply for a larger loan.

### 7.2 Admin flow
1. Admin navigates to `/dashboard` → opens "Limit Requests" tab.
2. Pending requests are listed (with borrower email, current vs. requested, reason).
3. Admin clicks "Review" → sees the borrower's **repayment history** (repaid count, on-time rate, total repaid).
   - This data comes from querying `loan_applications` filtered by `user_id` with `status = 'repaid'`.
4. Admin evaluates against the criteria in Section 1.
5. Admin approves (with optional notes + confirmed new limit) or denies (with notes).
6. Decision is recorded in `limit_increase_requests` (audit trail via `updated_at` + RLS).
7. If approved, `profiles.loan_limit` is updated in the same transaction (via `decideLimitRequest` RPC or client-side two-step with error handling).

### 7.3 Guardrails
- **One active request at a time**: the borrow submits a new request only if no `pending` request exists for them. Enforce in the API + UI.
- **Requested > current**: the modal validates `requested_limit > current_limit`.
- **Max cap**: admin can set any limit, but a group policy max (e.g. 500,000 MWK) should be enforced. Implement as: the `decideLimitRequest` function rejects `newLimit > MAX_POLICY_LIMIT`. Or enforce in the admin modal UI.
- **Limit decrease**: admin can also lower a limit (e.g., for risk). The `requested_limit` and `new_limit` fields support this — a request could be for a decrease, though the borrower-facing UI focuses on increases.

---

## 8. Audit & Events

- The `limit_increase_requests` table is itself the audit log for limit changes
  (status transitions, decided_by, decided_at, admin_notes).
- Optionally mirror significant decisions into `loan_events` via `logLoanEvent`
  with `action = 'limit_increased'` / `'limit_denied'` and `loan_id = null` —
  but `loan_id` is NOT NULL in that table. **Recommendation:** keep the audit
  in `limit_increase_requests` only; do not touch `loan_events` to avoid schema churn.

---

## 9. Files to Create / Modify

| File | Change |
|------|--------|
| `supabase/migration-loan-limits.sql` | **New** — migration (Section 3) |
| `src/api/limitIncreases.js` | **New** — API helpers (Section 5) |
| `src/components/LimitIncreaseRequestModal.jsx` | **New** — borrower request modal |
| `src/auth/AuthContext.jsx:18` | Add `loan_limit` to `PROFILE_COLUMNS` |
| `src/components/LoanForm.jsx` | Show limit, validate, add request link |
| `src/pages/UserDashboard.jsx` | Show limit, request button, pending banner |
| `src/pages/Dashboard.jsx` | Add Limit Requests tab + approve/deny UI |
| `src/api/loanDecisions.js` | Export `MAX_LOAN_LIMIT` constant (e.g. 500000) |

---

## 10. Validation Steps

1. **Run the migration** in Supabase SQL Editor → confirm `profiles.loan_limit` column exists, backfilled to 50000, and `limit_increase_requests` table + policies created.
2. **Submit a loan above the limit** as a borrower → the RLS `WITH CHECK` on `loan_applications` rejects it (`PG: 23514` constraint or RLS violation). App shows a clear message.
3. **Submit a loan at or below the limit** → succeeds.
4. **Borrower submits a limit-increase request** (with or without a reason) → row appears in `limit_increase_requests` with `status = 'pending'` and `reason = NULL` when omitted.
5. **Borrower tries a second pending request** → blocked by uniqueness guard.
6. **Admin approves** → `profiles.loan_limit` updates, request `status = 'approved'`, `decided_by`/`decided_at` populated.
7. **Borrower can now apply** for an amount up to the new limit.
8. **Admin denies** → request `status = 'denied'`, borrower sees status change in their UI.
9. **`npm run lint` and `npm run build` pass.**
10. **RLS check**: a borrower cannot read another borrower's requests; `anon` key cannot read `limit_increase_requests`.

---

## 11. Risks & Open Decisions

- **Default limit value (50,000 MWK):** calibrate to the group's actual lending policy. Document in README.
- **Admin review UI depth:** v1 shows repayment history as a simple list. Richer scoring (weighted criteria → suggestion) is a future enhancement.
- **Transaction safety:** `decideLimitRequest` does two writes (update `profiles` + update request). Wrap in a `try/catch`; if the profile update fails, the request should not be marked approved. For stronger atomicity, implement as a SECURITY DEFINER `approve_limit_request(p_request_id, p_new_limit, p_notes)` RPC that does both in one transaction. **Recommended for v1.5.**
- **Borrower email in admin list** requires the `admin_limit_requests()` RPC (Section 5) — do not attempt to read `auth.users.email` from the client directly (not exposed by RLS).
