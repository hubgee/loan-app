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
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
          ⏳
        </div>
        <h1 className="text-2xl font-bold text-slate-800">
          Account pending activation
        </h1>
        <p className="text-slate-600 text-sm">
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
            className="px-4 py-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            Logout
          </button>
        </div>
        <p className="text-sm text-slate-500">
          <Link to="/" className="text-indigo-600 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
