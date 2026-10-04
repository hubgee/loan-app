-- ============================================================
-- Migration: manual payment tracking (disbursement + repayment)
-- with reference numbers + proof uploads.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1) Widen loan status workflow:
--    pending -> approved -> confirmed -> disbursement_pending -> active -> repayment_pending -> repaid
--    (also: edit_requested, cancelled stay as interrupts)
do $$
begin
  alter table public.loan_applications drop constraint if exists loan_applications_status_check;
  alter table public.loan_applications
    add constraint loan_applications_status_check
    check (status in ('pending','approved','confirmed','disbursement_pending','active','repayment_pending','edit_requested','cancelled','repaid'));
exception when others then null;
end $$;

-- 2) organization_settings: admin payout destinations for borrowers to repay.
create table if not exists public.organization_settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.organization_settings enable row level security;

-- Authenticated users can read settings (borrowers need repay destination).
create policy "Authenticated can read organization settings"
  on public.organization_settings for select to authenticated
  using (true);

-- Only admins can update.
create policy "Admins can update organization settings"
  on public.organization_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can insert organization settings"
  on public.organization_settings for insert to authenticated
  with check (public.is_admin());

-- Seed defaults if empty.
insert into public.organization_settings (key, value)
values
  ('airtel_money', '{"name":"Kuwala Loans Airtel Money","number":""}'),
  ('tnm_mpamba', '{"name":"Kuwala Loans TNM Mpamba","number":""}'),
  ('bank_transfer', '{"bank":"Standard Bank","account_name":"Kuwala Loans","account_number":"","branch":""}')
on conflict (key) do nothing;

-- 3) loan_transactions table
create table if not exists public.loan_transactions (
  id uuid default gen_random_uuid() primary key,
  loan_id bigint not null references public.loan_applications(id) on delete cascade,
  type text not null check (type in ('disbursement','repayment')),
  reference_number text not null,
  payment_method text not null,
  amount numeric(12,2),
  proof_url text,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','confirmed','rejected')),
  submitted_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

create index if not exists loan_transactions_loan_id_idx on public.loan_transactions(loan_id);
create index if not exists loan_transactions_status_idx on public.loan_transactions(status);

alter table public.loan_transactions enable row level security;

-- Borrowers can insert transactions for their own loans.
create policy "Borrowers can insert own transactions"
  on public.loan_transactions for insert to authenticated
  with check (
    exists (select 1 from public.loan_applications l where l.id = loan_id and l.user_id = auth.uid())
  );

-- Borrowers can view transactions for their own loans.
create policy "Borrowers can view own transactions"
  on public.loan_transactions for select to authenticated
  using (
    exists (select 1 from public.loan_applications l where l.id = loan_id and l.user_id = auth.uid())
  );

-- Admins can view/manage all.
create policy "Admins can view all transactions"
  on public.loan_transactions for select to authenticated
  using (public.is_admin());

create policy "Admins can update all transactions"
  on public.loan_transactions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 4) proofs bucket (private).
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "Borrowers can upload own proofs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins can read proofs"
  on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.is_admin());

create policy "Borrowers can read own proofs"
  on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
