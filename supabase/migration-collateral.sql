-- ============================================================
-- Migration: collateral (replaces purpose in UI, purpose kept in DB)
-- Rule: collateral_value >= amount (principal floor).
-- Files: 4-6 per loan, images + PDFs, in proofs bucket.
-- ============================================================

-- 1) Columns on loan_applications
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='collateral_type') then
    alter table public.loan_applications add column collateral_type text
      check (collateral_type in ('land','vehicle','livestock','business_stock','electronics','household','guarantor','other'));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='collateral_description') then
    alter table public.loan_applications add column collateral_description text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='collateral_value') then
    alter table public.loan_applications add column collateral_value numeric(12,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='collateral_shortfall') then
    alter table public.loan_applications add column collateral_shortfall numeric(12,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='loan_applications' and column_name='shortfall_acknowledged') then
    alter table public.loan_applications add column shortfall_acknowledged boolean not null default false;
  end if;
end $$;

-- Floor: collateral must at least cover principal when both present.
do $$
begin
  alter table public.loan_applications drop constraint if exists loan_applications_collateral_floor_check;
  alter table public.loan_applications
    add constraint loan_applications_collateral_floor_check
    check (collateral_value is null or amount is null or collateral_value >= amount);
exception when others then null;
end $$;

-- 2) Files table (4-6 per loan enforced in app + trigger below)
create table if not exists public.loan_collateral_files (
  id uuid default gen_random_uuid() primary key,
  loan_id bigint not null references public.loan_applications(id) on delete cascade,
  storage_path text not null,
  original_name text,
  mime_type text,
  created_at timestamptz default now()
);

create index if not exists loan_collateral_files_loan_id_idx on public.loan_collateral_files(loan_id);

alter table public.loan_collateral_files enable row level security;

drop policy if exists "Borrowers can read own collateral files" on public.loan_collateral_files;
create policy "Borrowers can read own collateral files"
  on public.loan_collateral_files for select to authenticated
  using (exists (select 1 from public.loan_applications l where l.id = loan_id and l.user_id = auth.uid()));

drop policy if exists "Borrowers can insert own collateral files" on public.loan_collateral_files;
create policy "Borrowers can insert own collateral files"
  on public.loan_collateral_files for insert to authenticated
  with check (exists (select 1 from public.loan_applications l where l.id = loan_id and l.user_id = auth.uid()));

drop policy if exists "Admins can read collateral files" on public.loan_collateral_files;
create policy "Admins can read collateral files"
  on public.loan_collateral_files for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert collateral files" on public.loan_collateral_files;
create policy "Admins can insert collateral files"
  on public.loan_collateral_files for insert to authenticated
  with check (public.is_admin());

-- Storage: reuse private proofs bucket under {uid}/collateral/...
-- Borrower upload policy already allows {uid}/* in proofs bucket from
-- migration-payment-tracking.sql, admin read likewise. No new bucket needed.
