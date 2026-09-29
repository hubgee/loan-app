import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

// Private admin entry point. Deliberately NOT linked from the public UI.
// URL (local + Vercel): /admin/login -> on success -> /dashboard
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
      if (!profile) {
        await logout();
        setError(
          "No profile found for this account. Please contact support or try the borrower login at /login."
        );
        return;
      }
      if (profile.role !== "admin") {
        await logout();
        setError("Not an admin account. Borrowers please use /login.");
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Kuwala Loans • Restricted
        </p>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Admin Login</h1>
        <p className="text-sm text-slate-500 mb-4">
          Staff only. Borrowers use the regular login page.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="w-full border border-slate-200 rounded px-3 py-3"
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-slate-200 rounded px-3 py-3"
            required
            autoComplete="current-password"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 text-white py-3 rounded hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Login as admin"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-4">
          <Link to="/" className="text-indigo-600 hover:underline">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
