-- ============================================================
-- Fix: borrower can read payment proofs for their own loans.
-- Also allow admins to upload into the proofs bucket.
-- ============================================================

-- 1) Let admins upload proof files (e.g. disbursement receipts) into proofs.
-- This is needed when an admin uploads a file under a borrower's folder.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can upload proofs'
  ) then
    create policy "Admins can upload proofs"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'proofs' and public.is_admin());
  end if;
end $$;

-- 2) Allow borrowers to read any proof file attached to their own loan,
-- regardless of which user folder it was uploaded into.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Borrowers can read proofs for their loans'
  ) then
    create policy "Borrowers can read proofs for their loans"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'proofs'
        and exists (
          select 1
          from public.loan_transactions t
          join public.loan_applications l on l.id = t.loan_id
          where t.proof_url = storage.objects.name
            and l.user_id = auth.uid()
        )
      );
  end if;
end $$;
