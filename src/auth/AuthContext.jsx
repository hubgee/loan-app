import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../api/supabaseClient";

const AuthContext = createContext(null);

// Guard against a request that never settles (network stalls, RLS hangs).
// Without this a single hung call freezes the whole auth flow.
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monotonic token. Every profile read takes a ticket; a response is only
  // allowed to write state if it still holds the newest ticket. Without this,
  // a slow read issued before login()'s bootstrap can resolve AFTER it and
  // silently overwrite a fresh admin profile with a stale borrower one.
  const profileTicket = useRef(0);

  const isAdmin = profile?.role === "admin";
  const isActive = profile?.active === true;

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[auth] fetchProfile failed:", error.message);
      return null;
    }
    return data ?? null;
  }, []);

  const loadProfile = useCallback(
    async (sessionUser, preloadedProfile = null) => {
      const ticket = ++profileTicket.current;

      if (!sessionUser) {
        setUser(null);
        setProfile(null);
        return null;
      }

      // Optimistically expose the session so the Navbar updates immediately.
      setUser(sessionUser);

      const p = preloadedProfile ?? (await fetchProfile(sessionUser.id));

      // A newer read has started — this response is stale, drop it.
      if (ticket !== profileTicket.current) {
        return p;
      }

      setProfile(p);
      return p;
    },
    [fetchProfile]
  );

  useEffect(() => {
    let mounted = true;

    // Initial session restore — safe, runs outside any auth lock.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      await loadProfile(data.session?.user ?? null);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // CRITICAL: the auth client holds an internal lock while this callback
      // runs. Awaiting any other Supabase call here deadlocks the app forever
      // (symptoms: buttons stuck on "Verifying...", logout doing nothing).
      // Defer the async work to the next tick so the lock is released first.
      setTimeout(() => {
        loadProfile(session?.user ?? null).finally(() => {
          if (mounted) setLoading(false);
        });
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Promote this account to admin if its email matches app_settings.admin_email.
    // Runs security-definer server-side, so it bypasses RLS, and returns the
    // authoritative profile row so we don't need a racy second read.
    let promoted = null;
    try {
      const { data: rpcData, error: rpcError } = await withTimeout(
        supabase.rpc("bootstrap_admin_profile"),
        8000,
        "bootstrap_admin_profile"
      );
      if (rpcError) {
        console.error("[auth] admin bootstrap failed:", rpcError.message);
      } else if (rpcData && typeof rpcData === "object") {
        promoted = {
          id: rpcData.id,
          email: rpcData.email,
          role: rpcData.role,
          active: rpcData.active,
        };
      }
    } catch (err) {
      console.error("[auth] admin bootstrap error:", err.message);
    }

    const p = await loadProfile(data.user, promoted);
    return { user: data.user, profile: p };
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // With "Auto Confirm User" on, a session is returned immediately and the
    // DB trigger has already created the inactive profile row.
    if (data.session?.user) {
      const p = await loadProfile(data.session.user);
      return { user: data.session.user, profile: p };
    }

    // Email confirmation required: no session yet, just report the pending user.
    setUser(null);
    setProfile(null);
    return { user: data.user ?? null, profile: null };
  };

  const logout = async () => {
    // Invalidate any in-flight profile read so it can't repopulate state
    // after we've signed out.
    profileTicket.current++;
    try {
      await withTimeout(supabase.auth.signOut(), 8000, "signOut");
    } catch (err) {
      console.error("[auth] signOut failed, clearing local state anyway:", err.message);
    } finally {
      // Always clear local state so the UI can never get stuck signed in.
      setUser(null);
      setProfile(null);
    }
  };

  const refresh = async () => {
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    return loadProfile(current);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isActive,
        loading,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
