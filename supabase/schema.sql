-- ============================================================
-- Kuwala Loans — Supabase backend (Vercel frontend + Supabase)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
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

alter table public.loan_applications
  add column if not exists duration text not null default '1_week',
  add column if not exists interest_rate numeric(5,4) not null default 0.15,
  add column if not exists interest_amount numeric(12,2) not null default 0,
  add column if not exists total_repayment numeric(12,2) not null default 0,
  add column if not exists repayment_date date;

alter table public.loan_applications
  add column if not exists user_id uuid references public.users(id) on delete set null;

create index if not exists loan_applications_user_id_idx
  on public.loan_applications (user_id);

-- 2) Table: users — single source of truth for role + activation
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  role            text not null check (role in ('user','admin')) default 'user',
  active          boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.users enable row level security;

-- RLS policies for users table
drop policy if exists "Users can read own" on public.users;
create policy "Users can read own" on public.users
for select to authenticated
using (id = auth.uid());

drop policy if exists "Users can insert own" on public.users;
create policy "Users can insert own" on public.users
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "Admins can read users" on public.users;
create policy "Admins can read users" on public.users
for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Admins can update users" on public.users;
create policy "Admins can update users" on public.users
for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- 3) App settings table (stores admin email for bootstrap)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

-- 4) Trigger: auto-create inactive user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, role, active)
  values (new.id, new.email, 'user', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Admin bootstrap function (called by frontend after login)
-- This function checks if the current user's email matches the admin email
-- stored in app_settings, and if so, creates/updates their profile as admin.
create or replace function public.bootstrap_admin_profile()
returns void language plpgsql security definer as $$
declare
  admin_email text;
  user_email  text;
begin
  -- Get admin email from settings
  select value into admin_email from public.app_settings where key = 'admin_email';

  -- If no admin email configured, do nothing
  if admin_email is null then
    return;
  end if;

  -- Get current user's email
  select email into user_email from auth.users where id = auth.uid();

  -- If emails match, bootstrap admin profile
  if user_email is not null and lower(user_email) = lower(admin_email) then
    insert into public.users (id, email, role, active)
    values (auth.uid(), user_email, 'admin', true)
    on conflict (id) do update set role = 'admin', active = true;
  end if;
end;
$$;

-- 6) Storage bucket for uploaded National IDs (private)
insert into storage.buckets (id, name, public)
values ('ids', 'ids', false)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security: loan_applications
-- ============================================================
alter table public.loan_applications enable row level security;

drop policy if exists "Borrowers can submit own applications" on public.loan_applications;
create policy "Borrowers can submit own applications"
  on public.loan_applications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and processed_by is null
    and exists (select 1 from public.users u where u.id = auth.uid() and u.active = true)
  );

drop policy if exists "Borrowers can read own applications" on public.loan_applications;
create policy "Borrowers can read own applications"
  on public.loan_applications
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.active = true)
  );

drop policy if exists "Admins can read applications" on public.loan_applications;
create policy "Admins can read applications"
  on public.loan_applications
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Admins can update applications" on public.loan_applications;
create policy "Admins can update applications"
  on public.loan_applications
  for update to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- ============================================================
-- Storage RLS for the 'ids' bucket
-- ============================================================
drop policy if exists "Borrowers can upload own ids" on storage.objects;
create policy "Borrowers can upload own ids"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ids'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.users u where u.id = auth.uid() and u.active = true)
  );

drop policy if exists "Admins can read ids" on storage.objects;
create policy "Admins can read ids"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ids'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ============================================================
-- SETUP INSTRUCTIONS (Supabase Dashboard, one time)
-- ============================================================
-- 1. Authentication -> Settings -> enable "Auto Confirm User"
-- 2. Run this whole file in SQL Editor.
-- 3. Set the admin email in app_settings:
--      insert into public.app_settings (key, value)
--      values ('admin_email', 'your-admin-email@example.com')
--      on conflict (key) do update set value = excluded.value;
-- 4. Vercel -> Project -> Settings -> Environment Variables:
--      VITE_SUPABASE_URL=https://your-project.supabase.co
--      VITE_SUPABASE_ANON_KEY=<anon public key>
--    then Redeploy. Admin login lives at /admin/login (unlinked, private).
-- ============================================================
