-- ============================================================
-- Kuwala Loans — Supabase backend setup (free plan, testing)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- 1) Table: loan_applications
create table if not exists public.loan_applications (
  id              bigint generated always as identity primary key,
  borrower_name   text not null,
  email           text,
  phone           text,
  amount          numeric(12,2) not null,
  purpose         text,
  national_id_path text,
  national_id_original text,
  status          text not null default 'Pending'
                  check (status in ('Pending','Approved','Repaid')),
  processed_by    uuid,
  created_at      timestamptz not null default now()
);

create index if not exists loan_applications_status_idx
  on public.loan_applications (status);

-- 2) Storage bucket for uploaded National IDs (private)
insert into storage.buckets (id, name, public)
values ('ids', 'ids', false)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table public.loan_applications enable row level security;

-- Add duration + interest/repayment columns
alter table public.loan_applications
  add column if not exists duration text not null default '1_week',
  add column if not exists interest_rate numeric(5,4) not null default 0.15,
  add column if not exists interest_amount numeric(12,2) not null default 0,
  add column if not exists total_repayment numeric(12,2) not null default 0,
  add column if not exists repayment_date date;

-- Public (borrowers) can INSERT new applications.
-- We restrict only processed_by so columns can evolve freely.
drop policy if exists "Public can submit applications" on public.loan_applications;
create policy "Public can submit applications"
  on public.loan_applications
  for insert
  to anon, authenticated
  with check ( processed_by is null );

-- Admins (role = 'admin') can SELECT all applications.
drop policy if exists "Admins can read applications" on public.loan_applications;
create policy "Admins can read applications"
  on public.loan_applications
  for select
  to authenticated
  using ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- Admins can UPDATE status / processed_by.
drop policy if exists "Admins can update applications" on public.loan_applications;
create policy "Admins can update applications"
  on public.loan_applications
  for update
  to authenticated
  using ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' )
  with check ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- ============================================================
-- Storage RLS for the 'ids' bucket
-- NOTE: storage.objects already has RLS enabled by Supabase by default,
-- and your project role cannot ALTER it (ERROR 42501). Do NOT run
-- `alter table storage.objects enable row level security;` — it is
-- unnecessary. The policies below still apply correctly.
-- ============================================================

-- Only admins may read (download) uploaded IDs.
drop policy if exists "Admins can read ids" on storage.objects;
create policy "Admins can read ids"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ids'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Public can upload into the ids bucket (insert object).
drop policy if exists "Public can upload ids" on storage.objects;
create policy "Public can upload ids"
  on storage.objects
  for insert
  to anon, authenticated
  with check ( bucket_id = 'ids' );

-- ============================================================
-- NOTE: Creating admin users
-- 1. In Supabase Dashboard -> Authentication -> Users -> Add user
--    (enter email + password; check "Auto Confirm User").
-- 2. In the SQL editor run (replace the email):
--      update auth.users
--      set raw_user_meta_data = jsonb_build_object('role','admin')
--      where email = 'admin@kuwala-loans.com';
-- ============================================================
