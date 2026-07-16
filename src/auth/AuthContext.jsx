import { createContext, useState, useEffect } from "react";
import { supabase, isAdmin } from "../api/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const setFromSession = (session) => {
      const user = session?.user;
      setAdmin(user && isAdmin(user) ? user : null);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setFromSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setFromSession(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!isAdmin(data.user)) {
      await supabase.auth.signOut();
      throw new Error("This account is not authorized as an admin.");
    }
    setAdmin(data.user);
    return data.user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
