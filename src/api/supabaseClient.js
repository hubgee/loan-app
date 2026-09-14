import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔎 Debug logs removed per plan (supabaseClient cleanup)

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy helper (metadata-based). Prefer AuthContext profile (public.users) instead.
// Kept for backward-compat during migration.
export const isAdmin = (user) =>
  user?.user_metadata?.role === "admin" || user?.app_metadata?.role === "admin";
