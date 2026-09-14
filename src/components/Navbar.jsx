// src/components/Navbar.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, isActive, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/login");
  };

  const close = () => setOpen(false);

  return (
    <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center sticky top-0 z-50">
      <Link to="/" className="text-lg font-bold" onClick={close}>
        KUWALA-LOANS
      </Link>

      <button
        onClick={() => setOpen(!open)}
        className="md:hidden text-2xl focus:outline-none"
        aria-label="Menu"
      >
        ☰
      </button>

      <ul
        className={`absolute md:static bg-indigo-600 md:bg-transparent left-0 w-full md:w-auto md:flex md:space-x-4 md:items-center transition-all duration-300 ${
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
              <Link
                to="/apply"
                onClick={close}
                className="block py-2 px-4 hover:bg-indigo-700 md:hover:bg-transparent"
              >
                Apply
              </Link>
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
