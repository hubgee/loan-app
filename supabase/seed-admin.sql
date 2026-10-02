-- ============================================================
-- Promote ONE account to admin. Run this once, by hand, in the
-- Supabase Dashboard SQL Editor after schema.sql.
--
-- There is no login-time admin promotion: role is a property the
-- account HAS, set here, never granted by the client. Re-running this
-- file is safe and idempotent.
--
-- Replace the email below, then run.
-- ============================================================

update public.profiles
set role = 'admin',
    is_active = true
where id = (select id from auth.users where email = 'ADMIN_EMAIL_HERE');

-- Sanity check: must return exactly one row with role = admin.
-- select p.id, u.email, p.role, p.is_active
-- from public.profiles p
-- join auth.users u on u.id = p.id
-- where p.role = 'admin';