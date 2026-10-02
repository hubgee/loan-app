import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// NOTE: Do NOT pass an `accessToken` option here. That option is for
// bring-your-own-token setups and disables signInWithPassword / signUp /
// signOut in supabase-js. This SDK version (>= 2.107.0) uses the lockless
// auth client, so a plain client has no deadlock/hang issue.
//
// autoRefreshToken is intentionally left at its default (true). Disabling
// it means nothing refreshes a long-lived tab and every query starts 401ing
// on an expired access token. The ticker is not the bug — destroying the
// session when a refresh fails is.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  persistSession: true,
  autoDetectSessionInUrl: false,
});