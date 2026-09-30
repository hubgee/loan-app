import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Access-token cache + workaround for supabase-js auth lock hangs
// ---------------------------------------------------------------------------
// supabase-js 2.x (before the lockless rewrite in 2.107.0) routes every
// from()/rpc()/storage() call through _getAccessToken(), which can block
// forever behind its internal navigator.locks mutex (the _acquireLock
// pendingInLock drain loop — documented hang, see supabase-js issue #2376).
//
// Passing an `accessToken` callback short-circuits that path entirely: the
// client uses our cached token instead of entering the lock. This is the
// workaround endorsed by the Supabase team for these hangs.
//
// AuthContext keeps the cache warm (setCachedSession on every auth event).
// If the cache is cold or stale we fall back to getSession(), which runs
// after init completed, so it takes the normal (non-deadlock) refresh path.
let cachedAccessToken = null;
let cachedExpiry = 0;

// Reuse the SDK's ~90s refresh trigger as the cache freshness margin.
const CACHE_FRESH_MS = 60_000;

export function setCachedSession(session) {
  cachedAccessToken = session?.access_token ?? null;
  cachedExpiry = session?.expires_at ? session.expires_at * 1000 : 0;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    if (cachedAccessToken && cachedExpiry - Date.now() > CACHE_FRESH_MS) {
      return cachedAccessToken;
    }
    // Cold start or stale cache: resolve through the client's own session
    // handling. This runs after _initialize() resolved, so it cannot deadlock.
    const { data } = await supabase.auth.getSession();
    setCachedSession(data.session);
    return cachedAccessToken;
  },
});

// Legacy helper (metadata-based). Prefer AuthContext profile (public.users) instead.
// Kept for backward-compat during migration.
export const isAdmin = (user) =>
  user?.user_metadata?.role === "admin" || user?.app_metadata?.role === "admin";