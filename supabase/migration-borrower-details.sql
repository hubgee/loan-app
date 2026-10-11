-- Borrower details: gender + age on loan_applications.
-- Run once in Supabase Dashboard -> SQL Editor.
alter table public.loan_applications
  add column if not exists gender text check (gender in ('male','female')),
  add column if not exists age int check (age >= 18);
