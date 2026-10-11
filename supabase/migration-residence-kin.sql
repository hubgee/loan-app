-- Residence + next of kin details on loan_applications.
-- Run once in Supabase Dashboard -> SQL Editor.
alter table public.loan_applications
  add column if not exists residence_district text,
  add column if not exists residence_area text,
  add column if not exists residence_evidence_path text,
  add column if not exists residence_evidence_original text,
  add column if not exists kin_name text,
  add column if not exists kin_relationship text,
  add column if not exists kin_phone text,
  add column if not exists kin_national_id_path text,
  add column if not exists kin_national_id_original text,
  add column if not exists kin_district text,
  add column if not exists kin_area text;
