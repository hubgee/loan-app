# Plan: Borrower Accounts, Admin Activation & Personal Loan Tracking

## Goal
Convert the app from admin-only to a multi-role loan platform:
- Users sign up (email + password), are **inactive** until admin activates them.
- Active borrowers can apply for loans and track **only their own** applications.
- Admins manage users (activate/deactivate) and approve loans.

## Current State (from code inspection)
- Auth: Supabase email/password; `isAdmin` = `user_metadata.role === 'admin'` (set manually in SQL).
- `LoanForm` is public on `/`, inserts with `processed_by is null`, **no borrower attribution**.
- `Dashboard` + `ProtectedRoute` are admin-only, show all applications.
- RLS: public insert (processed_by null), admin select/update. No borrower policies.

## Design Decisions (Resolved)
1. **Roles in new `public.users` table** — single source of truth. Backfill existing admin(s).
2. **In-app admin activation** — `/admin/users` page toggles `active` (no service-role backend needed).
3. **Auto-confirm signups** (Supabase dashboard) so users log in immediately; DB trigger creates inactive `users` row.
4. **Pending users** see `/pending` screen; cannot apply or view data until activated.
5. **Loan attribution** — add `user_id` to `loan_applications`; RLS scopes by `auth.uid()` + `active` flag.
6. **Home page** becomes marketing/landing for non-authed; logged-in users route to their area.

---

## Schema Changes (Supabase SQL)

### 1. New `public.users` table
```sql
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  role            text not null check (role in ('user','admin')) default 'user',
  active          boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users read own row
drop policy if exists "Users can read own" on public.users;
create policy "Users can read own" on public.users
for select to authenticated
using (id = auth.uid());

-- Admins read all users
drop policy if exists "Admins can read users" on public.users;
create policy "Admins can read users" on public.users
for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- Admins update role/active
drop policy if exists "Admins can update users" on public.users;
create policy "Admins can update users" on public.users
for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
```

### 2. Trigger: auto-create inactive user row on signup
```sql
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
```

### 3. `loan_applications` — add `user_id` + borrower-scoped RLS
```sql
alter table public.loan_applications
  add column if not exists user_id uuid references public.users(id);

-- Borrowers insert own (active only)
drop policy if exists "Public can submit applications" on public.loan_applications;
create policy "Borrowers can submit own applications" on public.loan_applications
for insert to authenticated
with check (
  user_id = auth.uid()
  and processed_by is null
  and exists (select 1 from public.users u where u.id = auth.uid() and u.active = true)
);

-- Borrowers read own (active only)
drop policy if exists "Borrowers can read own applications" on public.loan_applications;
create policy "Borrowers can read own applications" on public.loan_applications
for select to authenticated
using (
  user_id = auth.uid()
  and exists (select 1 from public.users u where u.id = auth.uid() and u.active = true)
);

-- Admins read all (use users table)
drop policy if exists "Admins can read applications" on public.loan_applications;
create policy "Admins can read applications" on public.loan_applications
for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Admins can update applications" on public.loan_applications;
create policy "Admins can update applications" on public.loan_applications
for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
```

### 4. Storage: admin reads IDs via users table
```sql
drop policy if exists "Admins can read ids" on storage.objects;
create policy "Admins can read ids" on storage.objects
for select to authenticated
using (bucket_id = 'ids' and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
```

---

## Supabase Dashboard Setup
1. **Enable "Auto Confirm User"** under Authentication → Settings → Email Confirmations.
2. Run the schema SQL above in SQL Editor.
3. **Backfill existing admin**:
   ```sql
   insert into public.users (id, email, role, active)
   values ('<existing-admin-uuid>', '<admin-email>', 'admin', true)
   on conflict (id) do update set role = 'admin', active = true;
   ```
   (Find the admin UUID in Authentication → Users.)

---

## Frontend Changes

### New Files
| File | Purpose |
|------|---------|
| `src/pages/Signup.jsx` | Email + password signup; redirects to `/pending` |
| `src/pages/PendingActivation.jsx` | "Account pending admin activation" screen |
| `src/pages/UserDashboard.jsx` | Single page with tabs: **Apply** (LoanForm) + **My Loans** (read-only LoanTracker); mobile bottom nav |
| `src/pages/UserManagement.jsx` | Admin page: table of users, filter by role/active, toggle `active` switch |

### Modified Files
| File | Changes |
|------|---------|
| `src/App.jsx` | New routes: `/signup`, `/pending`, `/apply`, `/loans` (user), `/admin/users` (admin). Landing page at `/` for non-authed. Role-based redirects after login. |
| `src/auth/AuthContext.jsx` | Query `public.users` on session change; expose `{ user, isAdmin, isActive, loading, login, signup, logout, refresh }`. Remove metadata-based `isAdmin`. |
| `src/auth/useAuth.js` | Unchanged (hook pass-through). |
| `src/components/ProtectedRoute.jsx` | Accept `requiredRole?: 'user'|'admin'` and `requireActive?: boolean`. Redirect: inactive → `/pending`, wrong role → `/login`. |
| `src/components/Navbar.jsx` | Dynamic links: show Apply/My Loans for active users; Admin Dashboard/User Mgmt for admins. User menu with logout. |
| `src/components/LoanForm.jsx` | Require auth + active; add `user_id` on insert; remove public exposure. |
| `src/components/LoanTracker.jsx` | Add `editable` prop: users see status badges (no dropdown); admins see dropdown + progress bar. |
| `src/pages/Dashboard.jsx` | Admin dashboard unchanged except `isAdmin` source. Add link to User Management. |
| `src/pages/Login.jsx` | Redirect after login: admin → `/dashboard`, active user → `/loans`, inactive user → `/pending`. |
| `src/api/supabaseClient.js` | Update `isAdmin` to query `public.users` (or move check to AuthContext). Remove debug logs. |

### Removed / Replaced
- Public home-page loan form → replaced by landing page with CTAs.

---

## Data Flows

| Scenario | Flow |
|----------|------|
| **Signup** | User submits email+password → `supabase.auth.signUp()` → trigger creates `users` row (`active=false`) → session established (auto-confirm) → redirect `/pending` |
| **Admin Activation** | Admin logs in → `/admin/users` → clicks toggle → RLS `update` on `public.users` sets `active=true` → user refreshes → routed to `/apply` |
| **Apply for Loan** | Active user → `/apply` → fills LoanForm → submit → `LoanForm` inserts with `user_id = auth.uid()` → RLS validates active → redirect `/loans` |
| **Admin Approves** | Admin → `/dashboard` → status dropdown on row → RLS `update` on `loan_applications` → user sees new status on `/loans` |
| **User Tracks** | User → `/loans` (My Loans tab) → `LoanTracker` reads only `user_id = auth.uid()` → shows status badges + progress |

---

## Modern UI / Mobile-Friendly Refresh (Tailwind)

- **Palette**: `indigo-600` primary, `slate-800` text, `white` cards, `slate-50` backgrounds, `green-600` success, `amber-500` warning, `red-600` error.
- **Components**: Rounded-2xl cards, `shadow-sm`, `border slate-200`, generous padding.
- **Responsive**: Stack on mobile, side-by-side on `md:`. Forms full-width, large touch targets (`py-3`).
- **Bottom Nav (mobile `<md`)**: Fixed bar with Apply / My Loans / Menu icons; hidden on desktop where top tabs are used.
- **Landing (`/`)**: Hero with headline, benefit bullets, Sign Up / Login CTAs, footer.

---

## Validation Checklist

1. Run schema SQL in Supabase → verify tables, policies, trigger exist.
2. Enable Auto Confirm User in Supabase Auth settings.
3. Backfill admin user row.
4. `npm install` (no new dependencies needed).
5. `npm run dev` and test:
   - Sign up new user → lands on `/pending` (cannot access `/apply` or `/loans`).
   - Log in as admin → `/admin/users` → toggle new user `active=true`.
   - Refresh pending user → redirected to `/apply` → submit loan → lands on `/loans`.
   - Admin → `/dashboard` → change status to Approved → user sees status update.
   - Inactive user cannot submit (RLS blocks) nor read.
6. `npm run lint` passes.

---

## Risks / Open Questions

| Risk | Mitigation |
|------|------------|
| **Admin backfill missed** | Explicit setup step; admin cannot log in without users row. |
| **Trigger fails silently** | Test with a throwaway signup; check `public.users` row created. |
| **RLS active check in subquery** | Works but may be slower on large tables; acceptable for current scale. |
| **Dual auth sources during migration** | Plan migrates entirely to `public.users`; remove metadata checks. |
| **Auto-confirm setting not persisted** | Document as required setup; app shows warning if no session on signup. |
| **Pending users see LoanForm if they guess URL** | `ProtectedRoute` with `requireActive=true` on user routes blocks it. |

---

## Out of Scope (Backend Later)
- Email notifications on activation/approval.
- Password reset flow (Supabase handles via `resetPasswordForEmail`).
- File download for IDs (admin only, via storage).
- Admin audit log, user deletion, loan editing.

---

## Task Order (for implementation agent)

1. **Schema**: Run SQL in Supabase; verify in Table Editor + Policies.
2. **Supabase Dashboard**: Enable Auto Confirm; backfill admin.
3. **AuthContext**: Refactor to query `public.users`, add `signup`, expose `isActive`, `isAdmin`.
4. **ProtectedRoute**: Add `requiredRole` + `requireActive` logic.
5. **Navbar**: Dynamic links + user menu.
6. **Pages**: Create Signup, PendingActivation, UserDashboard, UserManagement.
7. **Routes**: Update `App.jsx` with new routes + landing page.
8. **LoanForm**: Add `user_id`, require auth+active.
9. **LoanTracker**: Add `editable` prop for user vs admin view.
10. **Dashboard/Login**: Update redirect logic + `isAdmin` source.
11. **UI Polish**: Apply modern Tailwind palette, bottom nav, responsive forms.
12. **Test**: Full flow validation per checklist.
13. **Lint**: `npm run lint`.