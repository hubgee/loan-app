import { createContext, useState, useEffect } from "react";
import { api, getCsrf } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/me")
      .then((res) => setAdmin(res.data.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    await getCsrf();
    const res = await api.post("/login", { email, password });
    setAdmin(res.data.admin);
    return res.data.admin;
  };

  const logout = async () => {
    await api.post("/logout");
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
