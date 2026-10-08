import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Login() {
  const { login } = useAuth();
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
        setError("Admins please log in at /admin/login.");
      } else if (profile?.is_active) {
        navigate("/loans");
      } else {
        navigate("/pending");
      }
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
          Borrower Login
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Don&apos;t have an account? Sign up, then wait for activation.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border border-slate-200 dark:border-slate-700 rounded px-3 py-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            required
          />
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-slate-200 dark:border-slate-700 rounded px-3 py-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            required
          />
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
          No account?{" "}
          <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Sign up
          </Link>{" "}
          •{" "}
          <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
