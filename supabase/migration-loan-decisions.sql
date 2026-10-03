-- ============================================================
-- Non-destructive migration: borrower confirm / edit / cancel
-- + Option B audit trail (loan_events).
-- Run once in Supabase SQL Editor. Safe to re-run.
-- DO NOT run schema.sql on a live project (it drops tables).
-- ============================================================

-- 1) Widen status values: pending, approved, confirmed,
--    edit_requested, cancelled, repaid.
do $$
begin
  alter table public.loan_applications drop constraint if exists loan_applications_status_check;
  alter table public.loan_applications
    add constraint loan_applications_status_check
    check (status in ('pending','approved','confirmed','edit_requested','cancelled','repaid'));
exception when others then null;
end $$;

-- 2) New decision columns.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='borrower_message') then
    alter table public.loan_applications add column borrower_message text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='borrower_decided_at') then
    alter table public.loan_applications add column borrower_decided_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='admin_seen') then
    alter table public.loan_applications add column admin_seen boolean not null default false;
  end if;
end $$;

-- Backfill: existing pending rows need admin attention.
update public.loan_applications set admin_seen = false where admin_seen is null;

-- 3) One-active-loan rule now covers confirmed + edit_requested.
drop index if exists public.loan_applications_one_active_per_user;
create unique index if not exists loan_applications_one_active_per_user
  on public.loan_applications (user_id)
  where status in ('pending', 'approved', 'confirmed', 'edit_requested');

create index if not exists loan_applications_admin_seen_idx
  on public.loan_applications (admin_seen) where admin_seen = false;

-- 4) Audit trail table.
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
  on public.loan_events for select to authenticated
  using (exists (select 1 from public.loan_applications l where l.id = loan_events.loan_id and l.user_id = auth.uid()));

drop policy if exists "Borrowers can insert own loan events" on public.loan_events;
create policy "Borrowers can insert own loan events"
  on public.loan_events for insert to authenticated
  with check (actor_role = 'borrower' and exists (select 1 from public.loan_applications l where l.id = loan_events.loan_id and l.user_id = auth.uid()));

drop policy if exists "Admins can read loan events" on public.loan_events;
create policy "Admins can read loan events"
  on public.loan_events for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert loan events" on public.loan_events;
create policy "Admins can insert loan events"
  on public.loan_events for insert to authenticated
  with check (public.is_admin() and actor_role = 'admin');

-- 5) Borrower decision policy: approved -> confirmed | edit_requested | cancelled only.
drop policy if exists "Borrowers can respond to approved loans" on public.loan_applications;
create policy "Borrowers can respond to approved loans"
  on public.loan_applications for update to authenticated
  using (user_id = auth.uid() and status = 'approved' and public.is_active_user())
  with check (user_id = auth.uid() and status in ('confirmed','edit_requested','cancelled'));
