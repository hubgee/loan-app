// src/components/Navbar.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../auth/useAuth";
import DarkModeToggle from "./DarkModeToggle";

const DASHBOARD_PATHS = ["/loans", "/dashboard"];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, isActive, logout } = useAuth();
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const showToggle = DASHBOARD_PATHS.includes(location.pathname);

  useEffect(() => {
    if (!user) {
      setHasActiveLoan(false);
      return;
    }
    if (isAdmin) {
      setHasActiveLoan(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("id")
        .eq("user_id", user.id)
        .in("status", [
          "pending",
          "approved",
          "confirmed",
          "disbursement_pending",
          "active",
          "repayment_pending",
          "forfeiture_pending",
          "edit_requested",
        ])
        .limit(1)
        .maybeSingle();
      if (!cancelled) setHasActiveLoan(!!data);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin]);

  const handleLogout = async () => {
    const wasAdmin = isAdmin;
    await logout();
    setOpen(false);
    navigate(wasAdmin ? "/admin/login" : "/login");
  };

  const close = () => setOpen(false);

  return (
    <nav className="bg-indigo-600 text-white p-4 flex items-center gap-4 sticky top-0 z-50">
      <Link to="/" className="text-lg font-bold" onClick={close}>
        KUWALA-LOANS
      </Link>

      {showToggle && (
        <span className="flex items-center">
          <DarkModeToggle />
        </span>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="md:hidden text-2xl focus:outline-none"
        aria-label="Menu"
      >
        ☰
      </button>

      <ul
        className={`absolute md:static md:ml-auto md:bg-transparent left-0 w-full md:w-auto bg-indigo-600 md:flex md:space-x-4 md:items-center transition-all duration-300 ${
          open ? "top-14" : "top-[-400px]"
        }`}
      >
        <li>
          <a
            href="/Terms-Conditions.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
          >
            Terms &amp; Conditions
          </a>
        </li>

        {!user && (
          <>
            <li>
              <Link
                to="/login"
                onClick={close}
                className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
              >
                Login
              </Link>
            </li>
            <li>
              <Link
                to="/signup"
                onClick={close}
                className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
              >
                Sign Up
              </Link>
            </li>
          </>
        )}

        {user && !isAdmin && isActive && (
          <>
            <li>
              {hasActiveLoan ? (
                <span className="block py-2 px-4 text-slate-300 cursor-not-allowed">
                  Apply (Loan active)
                </span>
              ) : (
                <Link
                  to="/apply"
                  onClick={close}
                  className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
                >
                  Apply
                </Link>
              )}
            </li>
            <li>
              <Link
                to="/loans"
                onClick={close}
                className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
              >
                My Loans
              </Link>
            </li>
          </>
        )}

        {user && !isAdmin && !isActive && (
          <li>
            <Link
              to="/pending"
              onClick={close}
              className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
            >
              Pending
            </Link>
          </li>
        )}

        {user && isAdmin && (
          <>
            <li>
              <Link
                to="/dashboard"
                onClick={close}
                className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/admin/users"
                onClick={close}
                className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
              >
                Users
              </Link>
            </li>
          </>
        )}

        {user && (
          <li className="flex items-center gap-2 py-2 px-4">
            <span className="text-xs opacity-80 truncate max-w-[140px]">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="block py-1 px-3 rounded bg-indigo-700 hover:bg-indigo-800 text-sm"
            >
              Logout
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
