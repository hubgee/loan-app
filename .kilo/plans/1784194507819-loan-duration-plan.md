# Loan duration + auto-calculated interest & repayment date

## Goal
Add a "Loan Duration" dropdown to the application form. When selected, the form shows:
1. Interest amount (predefined rates: 1 week = 15%, 2 weeks = 30%, 1 month = 60%)
2. Repayment date (today + chosen duration)

## Current state
- `src/components/LoanForm.jsx` — form collects name, email, phone, amount, purpose, nationalId. No duration/interest/repayment fields.
- `supabase/schema.sql` — `loan_applications` table has no `duration`, `interest_amount`, `total_repayment`, or `repayment_date` columns.
- `src/pages/Dashboard.jsx` — maps `loan_applications` rows to a lightweight shape for `LoanTracker`. No duration/interest/repayment fields in the mapped data.
- `src/components/LoanTracker.jsx` — renders name, amount, status, progress bar. No duration/interest/repayment columns.

## Decisions needed

### 1. Interest base
The interest should be calculated on the `amount` the user types. Recommended: compute `interest = amount * rate`, round to 2 decimals client-side, store both `interest_amount` and `total_repayment = amount + interest` in the DB.

### 2. Repayment date anchor
The requirement says "today's date + chosen duration." In reality `created_at` (disbursement date) would be more accurate, but the spec is explicit. Use `new Date()` at form-submit time to compute `repayment_date` and store it. (If the user wants `created_at` instead, swap it in — it's one line.)

### 3. Database migration
Add columns to `loan_applications`:
```sql
alter table public.loan_applications
  add column if not exists duration text not null default '1_week',
  add column if not exists interest_rate numeric(5,4) not null default 0.15,
  add column if not exists interest_amount numeric(12,2) not null default 0,
  add column if not exists total_repayment numeric(12,2) not null default 0,
  add column if not exists repayment_date date;
```
Run this in Supabase SQL Editor. Update RLS `WITH CHECK` for the public insert to also require these columns when present (or alter the policy to not gate on them, since the form always sets them).

### 4. Frontend changes

**`src/components/LoanForm.jsx`**
- Add a `duration` field to `formData` (default `"1_week"`).
- Add a dropdown `<select name="duration">` after the Amount field with options: `1_week`, `2_weeks`, `1_month`.
- Add a `useMemo` (or derived state) that watches `formData.amount` and `formData.duration` and computes:
  - `rate` map: `{ 1_week: 0.15, 2_weeks: 0.30, 1_month: 0.60 }`
  - `interest = amount * rate`
  - `repaymentDate = today + duration offset`
    - 1_week → `+7 days`
    - 2_weeks → `+14 days`
    - 1_month → `+1 month` (use `date-fns` or vanilla JS `setMonth`)
- Render the calculated values in real time below the dropdown, formatted:
  - "Interest: Mwk X"
  - "Repayment date: YYYY-MM-DD"
- Update the submit payload to include `duration`, `interest_rate`, `interest_amount`, `total_repayment`, `repayment_date`.
- Update the required-field validation to require `duration`.
- Store `duration` as the select value (e.g. `"1_week"`), and map to a human label for display.

**`src/pages/Dashboard.jsx`**
- When mapping applications, include `duration`, `interest_amount`, `total_repayment`, `repayment_date` in the mapped object.

**`src/components/LoanTracker.jsx`**
- Accept the new fields and render them in each loan card (e.g. "Duration: 2 weeks", "Interest: Mwk 300", "Total repayment: Mwk 1,300", "Due: YYYY-MM-DD").

**`src/api/supabaseClient.js`** — no changes needed.

### 5. Display format
Use the existing Tailwind classes. Show interest + repayment date in a small highlighted box under the dropdown. Keep it mobile-friendly.

### 6. Out of scope
- No change to storage, admin auth, or navigation.
- No change to the home page (`App.jsx`).
- Repayment date logic stays client-side; no server rounding needed.

## Risks / edge cases
- User types amount, then clears it: guard `interest = amount ? amount * rate : 0`.
- `setMonth` rollover (Jan 31 + 1 month = Mar 3): acceptable for testing; for production use `date-fns/addMonths`.
- Duration values stored as snake_case strings in DB; display mapped to Title Case.

## Validation
1. Run new SQL migration in Supabase → confirm 5 new columns exist.
2. Run `npm run lint && npm run build` → passes.
3. Manual: open Vercel site, open `/apply`, select each duration → confirm interest + date update instantly.
4. Manual: submit form → confirm row in Supabase Table Editor has correct values.
5. Manual: open `/dashboard` (admin) → confirm new fields visible in tracker.
