// src/components/Navbar.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Navbar({ admin }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <nav className="bg-blue-600 text-white p-4 flex justify-between items-center sticky top-0 z-50">
      {/* App Title */}
      <h1 className="text-lg font-bold">Loan App</h1>

      {/* Hamburger Button (mobile only) */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden text-2xl focus:outline-none"
      >
        ☰
      </button>

      {/* Navigation Links */}
      <ul
        className={`absolute md:static bg-blue-600 md:bg-transparent left-0 w-full md:w-auto md:flex md:space-x-6 transition-all duration-300 ${
          open ? "top-14" : "top-[-200px]"
        }`}
      >
        {admin && (
          <li>
            <Link
              to="/dashboard"
              className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
          </li>
        )}
        <li>
          <Link
            to="/apply"
            className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent"
            onClick={() => setOpen(false)}
          >
            Apply Loan
          </Link>
        </li>
        <li>
          <Link
            to="/"
            className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
        </li>
        {admin ? (
          <li>
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent w-full text-left"
            >
              Logout
            </button>
          </li>
        ) : (
          <li>
            <Link
              to="/login"
              className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent"
              onClick={() => setOpen(false)}
            >
              Admin Login
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
