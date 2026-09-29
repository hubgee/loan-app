import { createContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../api/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";
  const isActive = profile?.active === true;

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, active")
      .eq("id", userId)
      .single();
    if (error) return null;
    return data;
  }, []);

  const loadProfile = useCallback(
    async (sessionUser) => {
      if (!sessionUser) {
        setUser(null);
        setProfile(null);
        return null;
      }
      setUser(sessionUser);
      const p = await fetchProfile(sessionUser.id);
      setProfile(p);
      return p;
    },
    [fetchProfile]
  );

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

    // Bootstrap admin profile if this is the designated admin email
    await supabase.rpc("bootstrap_admin_profile");

    const p = await loadProfile(data.user);
    return { user: data.user, profile: p };
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
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
