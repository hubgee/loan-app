-- ============================================================
-- Kuwala Loans — Supabase backend (Vercel static frontend + Supabase)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- DESTRUCTIVE AND RE-RUNNABLE BY DESIGN. It drops every table,
-- function, trigger and policy this app owns, then recreates them.
-- There is no data migration; re-signup is expected afterwards.
-- ============================================================

-- ----------------------------------------------------------------
-- 0) Drop everything this app owns, in dependency order
-- ----------------------------------------------------------------
-- Triggers on public.loan_applications / public.profiles go away with their
-- tables below, so they are deliberately NOT dropped here: DROP TRIGGER IF
-- EXISTS still errors with 42P01 when the relation itself is missing, which
-- would abort this script on a fresh project.
drop trigger if exists on_auth_user_created on auth.users;

-- Tables first: dropping a table drops its RLS policies, and a policy holds a
-- dependency on the helper functions. Dropping the functions before the tables
-- would fail with "cannot drop function ... other objects depend on it".
drop table if exists public.loan_events cascade;
drop table if exists public.loan_applications cascade;
drop table if exists public.users cascade;
drop table if exists public.profiles cascade;
drop table if exists public.app_settings cascade;

-- The storage policies also depend on the helpers, so they go next.
drop policy if exists "Borrowers can upload own ids" on storage.objects;
drop policy if exists "Admins can read ids" on storage.objects;

-- admin_users() calls is_admin(), so it is dropped before it.
drop function if exists public.admin_users();
drop function if exists public.bootstrap_admin_profile();
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();
drop function if exists public.is_admin();
drop function if exists public.is_active_user();

-- ----------------------------------------------------------------
-- 1) Table: public.profiles
--    Renamed from `users` so it is never confused with auth.users.
--    `email` is deliberately absent: it is redundant with auth.users
--    and drifted every time an admin changed an address. The UI reads
--    the email off the auth session; admins list emails through
--    public.admin_users() below, which joins auth.users server-side.
-- ----------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'borrower' check (role in ('borrower','admin')),
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create index if not exists profiles_role_idx on public.profiles (role);

-- ----------------------------------------------------------------
-- 2) Table: public.loan_applications
--    Column set is exactly what the UI reads. `updated_at` is new so
--    a status change is auditable. Status is lowercase to match role.
-- ----------------------------------------------------------------
create table public.loan_applications (
  id                   bigint generated always as identity primary key,
  borrower_name        text not null,
  email                text,
  phone                text,
  amount               numeric(12,2) not null,
  duration             text not null default '1_week',
  interest_rate        numeric(5,4) not null default 0.15,
  interest_amount      numeric(12,2) not null default 0,
  total_repayment      numeric(12,2) not null default 0,
  repayment_date       date,
  purpose              text,
  national_id_path     text,
  national_id_original text,
  payout_method        text check (payout_method in ('mobile_money','bank')),
  payout_provider      text check (payout_provider in ('airtel_money','tnm_mpamba','fdh','national_bank','standard_bank')),
  payout_account_name  text,
  payout_account_number text,
  payout_branch        text,
  collateral_type      text check (collateral_type in ('land','vehicle','livestock','business_stock','electronics','household','guarantor','other')),
  collateral_description text,
  collateral_value     numeric(12,2),
  collateral_shortfall numeric(12,2),
  shortfall_acknowledged boolean not null default false,
  borrower_message     text,
  borrower_decided_at  timestamptz,
  admin_seen           boolean not null default false,
  status               text not null default 'pending'
                        check (status in ('pending','approved','confirmed','disbursement_pending','active','repayment_pending','edit_requested','cancelled','repaid')),
  processed_by         uuid,
  user_id              uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists loan_applications_status_idx
  on public.loan_applications (status);

create index if not exists loan_applications_user_id_idx
  on public.loan_applications (user_id);

create unique index if not exists loan_applications_one_active_per_user
  on public.loan_applications (user_id)
  where status in ('pending', 'approved', 'confirmed', 'disbursement_pending', 'active', 'repayment_pending', 'edit_requested');

-- ----------------------------------------------------------------
-- 3) RLS helper functions
--    These MUST exist before any policy that needs to know "is the
--    current user an admin / an active borrower".
--
--    Why a function instead of an inline subquery?
--    A policy like `exists (select 1 from public.profiles ...)`
--    written directly ON public.profiles re-triggers that table's own
--    RLS while Postgres is still evaluating it -> "infinite recursion
--    detected in policy for relation profiles" and the query fails.
--
--    SECURITY DEFINER makes the function run as the table owner, which
--    BYPASSES RLS, so the recursion never happens. Keep them as
--    functions — do not inline them.
-- ----------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
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
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  );
$$;

-- Grants: authenticated only. The old schema also granted these to
-- `anon`, which has no business calling them.
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_active_user() from public;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_user() to authenticated, service_role;

-- ----------------------------------------------------------------
-- 4) Admin user listing
--    public.profiles has no email column, so the admin user-management
--    screen cannot read addresses from it. This SECURITY DEFINER
--    function joins auth.users for the email and gates itself on
--    public.is_admin() — the anon key cannot use it.
-- ----------------------------------------------------------------
create or replace function public.admin_users()
returns table (
  id         uuid,
  email      text,
  role       text,
  is_active  boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, u.email, p.role, p.is_active, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at desc
$$;

revoke execute on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated, service_role;

-- ----------------------------------------------------------------
-- 5) RLS: public.profiles
-- ----------------------------------------------------------------
drop policy if exists "Users can read own" on public.profiles;
create policy "Users can read own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "Users can insert own" on public.profiles;
create policy "Users can insert own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- Uses is_admin() instead of an inline subquery to avoid recursion.
drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------
-- 6) RLS: public.loan_applications
-- ----------------------------------------------------------------
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

-- Borrower decisions: confirm / request edit / cancel.
-- Allowed ONLY from approved, and ONLY into the three borrower targets.
-- This prevents a borrower ever marking themselves repaid or
-- re-opening a closed loan. Field edits (amount, payout, etc.) ride
-- on the same UPDATE when moving to edit_requested.
drop policy if exists "Borrowers can respond to approved loans" on public.loan_applications;
create policy "Borrowers can respond to approved loans"
  on public.loan_applications
  for update to authenticated
  using (
    user_id = auth.uid()
    and status = 'approved'
    and public.is_active_user()
  )
  with check (
    user_id = auth.uid()
    and status in ('confirmed','edit_requested','cancelled')
  );

drop policy if exists "Borrowers can confirm disbursement" on public.loan_applications;
create policy "Borrowers can confirm disbursement"
  on public.loan_applications
  for update to authenticated
  using (
    user_id = auth.uid()
    and status = 'disbursement_pending'
    and public.is_active_user()
  )
  with check (
    user_id = auth.uid()
    and status in ('disbursement_pending','active')
  );

drop policy if exists "Borrowers can submit repayment" on public.loan_applications;
create policy "Borrowers can submit repayment"
  on public.loan_applications
  for update to authenticated
  using (
    user_id = auth.uid()
    and status = 'active'
    and public.is_active_user()
  )
  with check (
    user_id = auth.uid()
    and status = 'repayment_pending'
  );

-- ----------------------------------------------------------------
-- 6b) Table + RLS: public.loan_events (append-only audit trail)
-- ----------------------------------------------------------------
create table if not exists public.loan_events (
  id          bigint generated always as identity primary key,
  loan_id     bigint not null references public.loan_applications(id) on delete cascade,
  actor_role  text not null check (actor_role in ('borrower','admin')),
  actor_id    uuid,
  action      text not null,
  from_status text,
  to_status   text,
  message     text,
  created_at  timestamptz not null default now()
);

create index if not exists loan_events_loan_id_idx
  on public.loan_events (loan_id, created_at desc);

alter table public.loan_events enable row level security;

drop policy if exists "Borrowers can read own loan events" on public.loan_events;
create policy "Borrowers can read own loan events"
  on public.loan_events
  for select to authenticated
  using (
    exists (
      select 1 from public.loan_applications l
      where l.id = loan_events.loan_id
        and l.user_id = auth.uid()
    )
  );

drop policy if exists "Borrowers can insert own loan events" on public.loan_events;
create policy "Borrowers can insert own loan events"
  on public.loan_events
  for insert to authenticated
  with check (
    actor_role = 'borrower'
    and exists (
      select 1 from public.loan_applications l
      where l.id = loan_events.loan_id
        and l.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read loan events" on public.loan_events;
create policy "Admins can read loan events"
  on public.loan_events
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert loan events" on public.loan_events;
create policy "Admins can insert loan events"
  on public.loan_events
  for insert to authenticated
  with check (public.is_admin() and actor_role = 'admin');

-- ----------------------------------------------------------------
-- 7) Triggers
-- ----------------------------------------------------------------
-- Signup: every new auth user gets an inactive borrower profile.
-- Nothing here can produce an admin — role is only ever set by hand,
-- via supabase/seed-admin.sql.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, is_active)
  values (new.id, 'borrower', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_loan_applications_updated_at on public.loan_applications;
create trigger set_loan_applications_updated_at
  before update on public.loan_applications
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------
-- 8) Storage bucket for uploaded National IDs (private)
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ids', 'ids', false)
on conflict (id) do nothing;

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
-- SETUP (Supabase Dashboard)
-- ============================================================
-- 1. Authentication -> Settings -> enable "Auto Confirm User"
--    (so signups get a session immediately and land on /pending).
-- 2. Run this whole file in SQL Editor.
-- 3. Promote the admin account by hand — run supabase/seed-admin.sql
--    with the admin's email substituted. There is no login-time admin
--    promotion and no app_settings table any more.
-- 4. Vercel -> Project -> Settings -> Environment Variables:
--      VITE_SUPABASE_URL=https://your-project.supabase.co
--      VITE_SUPABASE_ANON_KEY=<anon public key>
--      VITE_AUTH_DEBUG=true            (optional; auth event logging)
--    Vite inlines VITE_* AT BUILD TIME. Saving an env var is not
--    enough — a change requires a REDEPLOY.
-- 5. Admin login lives at /admin/login (unlinked from the public UI).
-- ============================================================