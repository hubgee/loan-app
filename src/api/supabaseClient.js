import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔎 Debug logs — remove after testing
console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Anon Key:", supabaseAnonKey ? "Loaded" : "Missing");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isAdmin = (user) =>
  user?.user_metadata?.role === "admin" || user?.app_metadata?.role === "admin";
