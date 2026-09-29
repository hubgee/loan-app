import { createContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../api/supabaseClient";

const AuthContext = createContext(null);

// Designated admin email — set in Vercel env vars as VITE_ADMIN_EMAIL
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || null;

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, active")
    .eq("id", userId)
    .single();
  if (error) {
    // Missing row (e.g. SQL migration not run yet) -> treat as inactive non-admin
    return null;
  }
  return data;
}

// Auto-bootstrap: if the logged-in user's email matches VITE_ADMIN_EMAIL,
// ensure they have an active admin profile in public.users.
async function ensureAdminProfile(user) {
  if (!user?.email || !ADMIN_EMAIL) return null;
  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null;

  // Try to upsert the admin profile
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email,
        role: "admin",
        active: true,
      },
      { onConflict: "id" }
    )
    .select("id, email, role, active")
    .single();

  if (error) {
    console.error("Failed to bootstrap admin profile:", error);
    return null;
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";
  const isActive = profile?.active === true;
  // Backward-compat: old code expects `admin` (user object or null)
  const admin = isAdmin && user ? user : null;

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      setUser(null);
      setProfile(null);
      return null;
    }
    setUser(sessionUser);
    const p = await fetchProfile(sessionUser.id);
    setProfile(p);
    return p;
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await loadProfile(data.session?.user ?? null);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await loadProfile(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Auto-bootstrap admin profile if this is the designated admin email
    const adminProfile = await ensureAdminProfile(data.user);
    if (adminProfile) {
      setProfile(adminProfile);
      return { user: data.user, profile: adminProfile };
    }

    const p = await loadProfile(data.user);
    return { user: data.user, profile: p };
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // With "Auto Confirm" on, session exists immediately; trigger creates users row.
    if (data.session?.user) {
      const p = await loadProfile(data.session.user);
      return { user: data.session.user, profile: p };
    }
    if (data.user) {
      setUser(data.user);
      const p = await fetchProfile(data.user.id);
      setProfile(p);
      return { user: data.user, profile: p };
    }
    return { user: null, profile: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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
        admin,
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
