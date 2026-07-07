import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

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
        <li>
          <a href="#" className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent">
            Dashboard
          </a>
        </li>
        <li>
          <a href="#" className="block py-2 px-4 hover:bg-blue-700 md:hover:bg-transparent">
            Apply Loan
          </a>
        </li>
      </ul>
    </nav>
  );
}
