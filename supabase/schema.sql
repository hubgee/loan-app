-- ============================================================
-- Kuwala Loans — Supabase backend (Vercel frontend + Supabase)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- ----------------------------------------------------------------
-- 0) RLS helper functions
-- ----------------------------------------------------------------
-- These MUST exist before any policy that needs to know "is the
-- current user an admin / an active borrower".
--
-- Why a function instead of an inline subquery?
-- A policy like `exists (select 1 from public.users ...)` written
-- directly ON public.users re-triggers public.users' own RLS while
-- Postgres is still evaluating it -> "infinite recursion detected in
-- policy for relation users" and the whole query fails.
--
-- SECURITY DEFINER makes the function run as the table owner, which
-- BYPASSES RLS, so the recursion never happens.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.active = true
  );
$$;

grant execute on function public.is_admin() to authenticated, anon, service_role;
grant execute on function public.is_active_user() to authenticated, anon, service_role;

-- ----------------------------------------------------------------
-- 1) Table: users — single source of truth for role + activation
--    Created BEFORE loan_applications because the FK below needs it.
-- ----------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('user','admin')) default 'user',
  active     boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "Users can read own" on public.users;
create policy "Users can read own" on public.users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "Users can insert own" on public.users;
create policy "Users can insert own" on public.users
  for insert to authenticated
  with check (id = auth.uid());

-- Uses is_admin() instead of an inline subquery to avoid recursion.
drop policy if exists "Admins can read users" on public.users;
create policy "Admins can read users" on public.users
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update users" on public.users;
create policy "Admins can update users" on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------
-- 2) Table: loan_applications
-- ----------------------------------------------------------------
create table if not exists public.loan_applications (
  id                   bigint generated always as identity primary key,
  borrower_name        text not null,
  email                text,
  phone                text,
  amount               numeric(12,2) not null,
  purpose              text,
  national_id_path     text,
  national_id_original text,
  status               text not null default 'Pending'
                       check (status in ('Pending','Approved','Repaid')),
  processed_by         uuid,
  created_at           timestamptz not null default now()
);

create index if not exists loan_applications_status_idx
  on public.loan_applications (status);

alter table public.loan_applications
  add column if not exists duration text not null default '1_week',
  add column if not exists interest_rate numeric(5,4) not null default 0.15,
  add column if not exists interest_amount numeric(12,2) not null default 0,
  add column if not exists total_repayment numeric(12,2) not null default 0,
  add column if not exists repayment_date date;

-- Borrower attribution (added after public.users now exists)
alter table public.loan_applications
  add column if not exists user_id uuid references public.users(id) on delete set null;

create index if not exists loan_applications_user_id_idx
  on public.loan_applications (user_id);

-- ----------------------------------------------------------------
-- 3) App settings (stores the designated admin email)
--    RLS is enabled with NO policies on purpose: the only reader is the
--    SECURITY DEFINER function below, so the anon key cannot list it.
-- ----------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

-- ----------------------------------------------------------------
-- 4) Trigger: auto-create inactive user row on signup
-- ----------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- ----------------------------------------------------------------
-- 5) Admin bootstrap RPC (called by the frontend right after login)
--    Promotes the account to admin if its email matches app_settings.
-- ----------------------------------------------------------------
create or replace function public.bootstrap_admin_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_email text;
  user_email  text;
  result      jsonb;
begin
  select value into admin_email
    from public.app_settings
   where key = 'admin_email';

  if admin_email is null or admin_email = '' then
    return null;
  end if;

  select email into user_email
    from auth.users
   where id = auth.uid();

  if user_email is null or lower(user_email) <> lower(admin_email) then
    return null;
  end if;

  insert into public.users (id, email, role, active)
  values (auth.uid(), user_email, 'admin', true)
  on conflict (id) do update
    set role = 'admin', active = true, email = excluded.email;

  -- Return the authoritative row so the client never has to re-read it
  -- (a second read could race the onAuthStateChange fetch and lose).
  select to_jsonb(u) into result
    from public.users u
   where u.id = auth.uid();

  return result;
end;
$$;

grant execute on function public.bootstrap_admin_profile() to authenticated, anon, service_role;

-- ----------------------------------------------------------------
-- 6) Storage bucket for uploaded National IDs (private)
-- ----------------------------------------------------------------
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
    and public.is_active_user()
  );

drop policy if exists "Borrowers can read own applications" on public.loan_applications;
create policy "Borrowers can read own applications"
  on public.loan_applications
  for select to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_user()
  );

drop policy if exists "Admins can read applications" on public.loan_applications;
create policy "Admins can read applications"
  on public.loan_applications
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update applications" on public.loan_applications;
create policy "Admins can update applications"
  on public.loan_applications
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Storage RLS for the 'ids' bucket
-- NOTE: storage.objects already has RLS enabled by Supabase.
-- Do NOT run `alter table storage.objects enable row level security;`
-- (ERROR 42501 on free plan). Policies below still apply.
-- ============================================================

drop policy if exists "Borrowers can upload own ids" on storage.objects;
create policy "Borrowers can upload own ids"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ids'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

drop policy if exists "Admins can read ids" on storage.objects;
create policy "Admins can read ids"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ids'
    and public.is_admin()
  );

-- ============================================================
-- SETUP (Supabase Dashboard, one time)
-- ============================================================
-- 1. Authentication -> Settings -> enable "Auto Confirm User"
--    (so signups get a session immediately and land on /pending).
-- 2. Run this whole file in SQL Editor.
-- 3. Set the admin email (must match the Supabase auth user's email):
--      insert into public.app_settings (key, value)
--      values ('admin_email', 'your-admin-email@example.com')
--      on conflict (key) do update set value = excluded.value;
-- 4. Vercel -> Project -> Settings -> Environment Variables:
--      VITE_SUPABASE_URL=https://your-project.supabase.co
--      VITE_SUPABASE_ANON_KEY=<anon public key>
--    then Redeploy. Admin login lives at /admin/login (unlinked, private).
-- ============================================================
