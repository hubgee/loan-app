import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function PendingActivation() {
  const { user, isAdmin, isActive, status, refresh, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "initializing" || status === "error") return;
    if (!user) navigate("/login");
    else if (isAdmin) navigate("/dashboard");
    else if (isActive) navigate("/loans");
  }, [user, isAdmin, isActive, status, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center text-2xl text-amber-700 dark:text-amber-200">
          ⏳
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Account pending activation
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          Thanks for signing up{user?.email ? ` as ${user.email}` : ""}. An
          admin needs to activate your account before you can apply for loans.
          Please check back later.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => refresh()}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            I&apos;ve been activated — refresh
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
          >
            Logout
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
