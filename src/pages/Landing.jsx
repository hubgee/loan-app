import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Landing() {
  const { user, isAdmin, isActive } = useAuth();

  const cta = !user
    ? { to: "/signup", label: "Get started" }
    : isAdmin
      ? { to: "/dashboard", label: "Go to dashboard" }
      : isActive
        ? { to: "/loans", label: "My loans" }
        : { to: "/pending", label: "Check status" };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-5">
          <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 text-xs font-semibold">
            KUWALA LOANS • Fast personal loans
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
            Borrow simply. Track clearly.
          </h1>
          <ul className="space-y-2 text-slate-600 dark:text-slate-300">
            <li>✅ 1 week, 2 weeks or 1 month terms</li>
            <li>✅ Transparent interest up front</li>
            <li>✅ Track Pending → Approved → Repaid</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={cta.to}
              className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-center font-semibold hover:bg-indigo-700"
            >
              {cta.label}
            </Link>
            {!user && (
              <Link
                to="/login"
                className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center font-semibold hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Log in
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            New here? Sign up, wait for admin activation, then apply.
          </p>
        </div>
        <div className="bg-green-900 rounded-2xl overflow-hidden shadow-sm">
          <img
            src="/kuwala-loan.png"
            alt="Kuwala Loan Agency"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      <footer className="border-t border-slate-200 dark:border-slate-700 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Kuwala Loans •{" "}
        <a href="/Terms-Conditions.pdf" className="underline text-indigo-600 dark:text-indigo-400">
          Terms &amp; Conditions
        </a>
      </footer>
    </div>
  );
}
