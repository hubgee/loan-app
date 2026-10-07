-- ============================================================
-- Migration: two settlement modes (cash vs collateral forfeit).
-- - 'repaid' stays strictly for cash repayment.
-- - 'forfeited' closes the loan via collateral (borrower request + admin approval).
-- Run once in Supabase SQL Editor. Safe to re-run.
-- DO NOT run schema.sql on a live project (it drops tables).
-- ============================================================

-- 1) New settlement / forfeiture columns on loan_applications.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='settlement_method') then
    alter table public.loan_applications add column settlement_method text
      check (settlement_method in ('cash','collateral_forfeit'));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='settled_at') then
    alter table public.loan_applications add column settled_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='settled_by') then
    alter table public.loan_applications add column settled_by uuid references public.profiles(id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='forfeiture_requested_at') then
    alter table public.loan_applications add column forfeiture_requested_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='forfeiture_approved_at') then
    alter table public.loan_applications add column forfeiture_approved_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='forfeiture_declined_at') then
    alter table public.loan_applications add column forfeiture_declined_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='forfeiture_reason') then
    alter table public.loan_applications add column forfeiture_reason text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='shortfall_outstanding') then
    alter table public.loan_applications add column shortfall_outstanding numeric(12,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='shortfall_written_off') then
    alter table public.loan_applications add column shortfall_written_off boolean not null default false;
  end if;
end $$;

-- 2) Widen status enum: add forfeiture_pending + forfeited.
do $$
begin
  alter table public.loan_applications drop constraint if exists loan_applications_status_check;
  alter table public.loan_applications
    add constraint loan_applications_status_check
    check (status in ('pending','approved','confirmed','disbursement_pending','active','repayment_pending','forfeiture_pending','edit_requested','cancelled','repaid','forfeited'));
exception when others then null;
end $$;

-- 3) One-active-loan rule: forfeiture_pending counts as in-progress (blocks new apply).
-- forfeited / repaid / cancelled stay closed (do not block).
drop index if exists public.loan_applications_one_active_per_user;
create unique index if not exists loan_applications_one_active_per_user
  on public.loan_applications (user_id)
  where status in ('pending','approved','confirmed','disbursement_pending','active','repayment_pending','forfeiture_pending','edit_requested');

-- 4) Borrower can request forfeiture: active -> forfeiture_pending only.
-- Admin approve/decline rides on the existing "Admins can update applications" policy.
drop policy if exists "Borrowers can request forfeiture" on public.loan_applications;
create policy "Borrowers can request forfeiture"
  on public.loan_applications for update to authenticated
  using (user_id = auth.uid() and status = 'active' and public.is_active_user())
  with check (user_id = auth.uid() and status = 'forfeiture_pending');
