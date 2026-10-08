import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { profile } = await login(email, password);

      if (profile?.role === "admin") {
        navigate("/dashboard", { replace: true });
        return;
      }

      // Not an admin — clear the session so we never sit half-authenticated.
      await logout();

      if (!profile) {
        setError(
          "No profile record found for this account. Ask your developer to re-run the Supabase schema so the signup trigger exists."
        );
      } else {
        setError(
          "This account is registered as a borrower, not an admin. Admin is granted once by hand — ask your developer to run supabase/seed-admin.sql with this email."
        );
      }
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Kuwala Loans • Restricted
        </p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Admin Login</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Staff only. Borrowers use the regular login page.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="w-full border border-slate-200 dark:border-slate-700 rounded px-3 py-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-slate-200 dark:border-slate-700 rounded px-3 py-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            required
            autoComplete="current-password"
          />
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Login as admin"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
          <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
