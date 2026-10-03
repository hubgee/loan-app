# Single Active Loan Restriction Plan

## Goal
Restrict borrowers to ONE active loan (status `pending` or `approved`) at a time. They can only apply for a new loan after the current one is `repaid`.

---

## Changes Required

### 1. Database Level (Supabase) - Recommended for Data Integrity
**File:** `supabase/schema.sql`

Add a partial unique index to prevent multiple active loans per user:
```sql
-- Add after line 90 (after loan_applications_user_id_idx)
create unique index if not exists loan_applications_one_active_per_user
  on public.loan_applications (user_id)
  where status in ('pending', 'approved');
```
- Allows multiple `repaid` loans
- Blocks INSERT/UPDATE that would create a second `pending` or `approved` loan
- Enforced at DB level - works even if frontend bypassed

---

### 2. Frontend Validation (LoanForm.jsx) - Better UX
**File:** `src/components/LoanForm.jsx`

Add check before submission (around line 62-80):
```javascript
// Check for existing active loan
const { data: activeLoan } = await supabase
  .from("loan_applications")
  .select("id, status")
  .eq("user_id", user.id)
  .in("status", ["pending", "approved"])
  .maybeSingle();

if (activeLoan) {
  setMessage(`You already have a ${activeLoan.status} loan. Please repay it before applying for a new one.`);
  return;
}
```
- Shows friendly error message before attempting DB insert
- Avoids confusing DB constraint violation errors

---

### 3. Optional: Disable Apply Tab When Active Loan Exists
**File:** `src/pages/UserDashboard.jsx`

In `load()` function (around line 30-40), also fetch active loan count:
```javascript
const { data: activeLoan } = await supabase
  .from("loan_applications")
  .select("id")
  .eq("user_id", user.id)
  .in("status", ["pending", "approved"])
  .maybeSingle();

setHasActiveLoan(!!activeLoan);
```
Then conditionally hide/disable the "Apply" tab when `hasActiveLoan` is true.

---

## Validation Steps

1. **Deploy schema change** to Supabase (run the new index creation)
2. **Test frontend:**
   - Apply for loan → status becomes `pending`
   - Try to apply again → should show error message
   - Admin approves loan → status `approved`
   - Try to apply again → should show error
   - Admin marks loan `repaid`
   - Apply again → should succeed
3. **Edge cases:**
   - Race condition: two rapid submissions (DB index catches this)
   - Admin manually changes status in DB (index enforces)

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `supabase/schema.sql` | Add partial unique index |
| `src/components/LoanForm.jsx` | Add pre-submit active loan check |
| `src/pages/UserDashboard.jsx` | Optional: hide Apply tab when active loan exists |

---

## Questions for User

1. **Should the restriction apply at DB level, frontend level, or both?** (Recommended: both for defense in depth)

2. **What statuses count as "active"?** Currently assuming `pending` + `approved`. Should `repaid` be the only non-active status?

3. **Should the "Apply" tab be hidden or just disabled with a message?** (Hidden = cleaner, Disabled = more discoverable)

4. **Do you want me to proceed with implementation?**