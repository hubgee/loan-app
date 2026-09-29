# Plan: Separate Admin and User Login Flows

## Problem
- Frontend uses Supabase Auth; backend uses Laravel (separate systems)
- User signed up via `/signup` → creates `role='user'` in Supabase
- Same credentials fail at `/admin/login` because role is `user`, not `admin`
- Need fresh credentials for both user and admin with proper separation

## Current Architecture
- **Frontend (React + Supabase)**: Auth via Supabase, roles in `public.users` table
- **Backend (Laravel)**: Separate `users` and `admins` tables, not used by frontend
- Admin login at `/admin/login` checks `profile.role === 'admin'`
- User login at `/login` rejects admins, redirects to `/admin/login`

## Required Changes

### 1. Create Admin User in Supabase (SQL)
Run in Supabase SQL Editor:
```sql
-- Replace with actual admin UUID from Supabase Auth > Users
INSERT INTO public.users (id, email, role, active)
VALUES ('<admin-auth-uuid>', 'admin@kuwala.com', 'admin', true)
ON CONFLICT (id) DO UPDATE SET role = 'admin', active = true;
```
**Prerequisite**: Create auth user first in Supabase Dashboard > Authentication > Users > "Invite User" or sign up, then copy UUID.

### 2. Create Regular User (Fresh)
- Go to `/signup` with new email/password
- Creates `role='user'`, `active=false`
- Admin activates via `/admin/users` (sets `active=true`)
- User then logs in at `/login` → `/loans`

### 3. Verify Separation Works
- Admin credentials → `/admin/login` → `/dashboard`
- User credentials → `/login` → `/loans` (if active) or `/pending` (if not)
- Cross-attempts show proper error messages

### 4. Optional: Remove Admin Link from Public Navbar
Current Navbar shows "Dashboard" and "Users" links for `isAdmin` users — this is fine since only logged-in admins see them. No public link to `/admin/login`.

## Validation Steps
1. Create admin in Supabase (SQL)
2. Sign up new user at `/signup`
3. Activate user via admin panel
4. Test admin login at `/admin/login`
5. Test user login at `/login`
6. Verify cross-login attempts are rejected with clear messages

## Out of Scope
- Laravel backend auth (separate system, not used by frontend)
- Email confirmation flows (Supabase "Auto Confirm" enabled)
- Password reset flows