import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../api/supabaseClient";

const AuthContext = createContext(null);

// Guard against a request that never settles. supabase-js's lock-based auth
// had documented deadlock/refresh-loop bugs; a hanging call must never be
// able to freeze the auth flow.
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

  // Monotonic token. Every profile read takes a ticket; a response only
  // writes state if it still holds the newest ticket. Without this a slow
  // read issued before login()'s admin bootstrap can resolve AFTER it and
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

      setUser(sessionUser);

      let p = preloadedProfile;
      if (!p) {
        try {
          p = await withTimeout(fetchProfile(sessionUser.id), 8000, "fetchProfile");
        } catch (err) {
          console.error("[auth] fetchProfile error:", err.message);
          p = null;
        }
      }

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
    let unsubscribe;

    const setup = async () => {
      // 1) Restore the session FIRST, letting the auth client fully finish
      //    its lock/refresh init while we await it.
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await loadProfile(data.session?.user ?? null);
      if (!mounted) return;
      setLoading(false);

      // 2) Only NOW register the listener, after init is complete.
      //    Registering onAuthStateChange during _initialize() is a documented
      //    cause of deadlocks and refresh-token races ("sometimes the page
      //    works, sometimes you get signed out").
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null;

        // Reflect the session synchronously (no supabase calls while the
        // SDK holds its internal auth lock).
        setUser(u);

        if (!u) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // Fetch the profile on the next tick, outside the auth lock, and let
        // the ticket guard discard anything that races a login/bootstrap.
        setTimeout(() => {
          loadProfile(u).finally(() => {
            if (mounted) setLoading(false);
          });
        }, 0);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    };

    setup();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Promote to admin if email matches app_settings.admin_email. Runs
    // security-definer server-side (bypasses RLS) and returns the
    // authoritative row so we don't need a second, racy read.
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

    // Email confirmation required: no session yet.
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