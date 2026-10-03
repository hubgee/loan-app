-- ============================================================
-- Non-destructive migration: add payout / disbursement details
-- to loan_applications. Run once in Supabase SQL Editor if you
-- already have the base schema applied (do NOT re-run schema.sql
-- in production — it drops tables).
-- Safe to re-run: each ADD COLUMN is guarded.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loan_applications'
      and column_name = 'payout_method'
  ) then
    alter table public.loan_applications
      add column payout_method text
        check (payout_method in ('mobile_money','bank'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loan_applications'
      and column_name = 'payout_provider'
  ) then
    alter table public.loan_applications
      add column payout_provider text
        check (payout_provider in ('airtel_money','tnm_mpamba','fdh','national_bank','standard_bank'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loan_applications'
      and column_name = 'payout_account_name'
  ) then
    alter table public.loan_applications
      add column payout_account_name text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loan_applications'
      and column_name = 'payout_account_number'
  ) then
    alter table public.loan_applications
      add column payout_account_number text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loan_applications'
      and column_name = 'payout_branch'
  ) then
    alter table public.loan_applications
      add column payout_branch text;
  end if;
end $$;
