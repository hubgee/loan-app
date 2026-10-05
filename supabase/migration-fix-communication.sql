-- ============================================================
-- Fix: borrower <-> admin communication loop for disbursement
-- and repayment. Run once in Supabase SQL Editor.
-- ============================================================

-- 1) Allow disbursement_pending / active / repayment_pending statuses
-- (in case payment-tracking migration was run before decisions fix).
do $$
begin
  alter table public.loan_applications drop constraint if exists loan_applications_status_check;
  alter table public.loan_applications
    add constraint loan_applications_status_check
    check (status in ('pending','approved','confirmed','disbursement_pending','active','repayment_pending','edit_requested','cancelled','repaid'));
exception when others then null;
end $$;

-- 2) One-active-loan rule must cover the whole money-in-motion chain.
drop index if exists public.loan_applications_one_active_per_user;
create unique index if not exists loan_applications_one_active_per_user
  on public.loan_applications (user_id)
  where status in ('pending','approved','confirmed','disbursement_pending','active','repayment_pending','edit_requested');

-- 3) Borrower updates: the old policy only allowed approved -> confirmed/
-- edit_requested/cancelled, so "I received it" (disbursement_pending -> active)
-- and "Submit repayment" (active -> repayment_pending) were rejected by RLS
-- and the UI looked stuck.
drop policy if exists "Borrowers can respond to approved loans" on public.loan_applications;
create policy "Borrowers can respond to approved loans"
  on public.loan_applications for update to authenticated
  using (user_id = auth.uid() and status = 'approved' and public.is_active_user())
  with check (user_id = auth.uid() and status in ('confirmed','edit_requested','cancelled'));

drop policy if exists "Borrowers can confirm disbursement" on public.loan_applications;
create policy "Borrowers can confirm disbursement"
  on public.loan_applications for update to authenticated
  using (user_id = auth.uid() and status = 'disbursement_pending' and public.is_active_user())
  with check (user_id = auth.uid() and status in ('disbursement_pending','active'));

drop policy if exists "Borrowers can submit repayment" on public.loan_applications;
create policy "Borrowers can submit repayment"
  on public.loan_applications for update to authenticated
  using (user_id = auth.uid() and status = 'active' and public.is_active_user())
  with check (user_id = auth.uid() and status = 'repayment_pending');

-- 4) Borrower must be able to mark their own disbursement transaction
-- as confirmed when they tap "I received it".
drop policy if exists "Borrowers can confirm own disbursement" on public.loan_transactions;
create policy "Borrowers can confirm own disbursement"
  on public.loan_transactions for update to authenticated
  using (
    type = 'disbursement' and status = 'pending_confirmation'
    and exists (select 1 from public.loan_applications l where l.id = loan_id and l.user_id = auth.uid())
  )
  with check (type = 'disbursement' and status = 'confirmed');
