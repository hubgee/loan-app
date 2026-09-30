import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// NOTE: Do NOT pass an `accessToken` option here. That option is for
// bring-your-own-token setups and disables signInWithPassword / signUp /
// signOut in supabase-js. This SDK version (>= 2.107.0) uses the lockless
// auth client, so a plain client has no deadlock/hang issue.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy helper (metadata-based). Prefer AuthContext profile (public.users) instead.
// Kept for backward-compat during migration.
export const isAdmin = (user) =>
  user?.user_metadata?.role === "admin" || user?.app_metadata?.role === "admin";