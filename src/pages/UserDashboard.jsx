import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoanForm from "../components/LoanForm";
import LoanTracker from "../components/LoanTracker";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../auth/useAuth";

function mapRow(l) {
  return {
    id: l.id,
    name: l.borrower_name,
    email: l.email,
    phone: l.phone,
    amount: l.amount,
    duration: l.duration,
    interest_amount: l.interest_amount,
    total_repayment: l.total_repayment,
    repayment_date: l.repayment_date,
    purpose: l.purpose,
    status: l.status,
  };
}

export default function UserDashboard({ initialTab = "apply" }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab === "loans" ? "loans" : "apply");
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setLoans((data || []).map(mapRow));
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initialTab === "loans" ? "loans" : "apply");
  }, [initialTab]);

  const handleNewLoan = () => {
    load();
    setTab("loans");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">My Loans</h1>

        {/* Desktop tabs */}
        <div className="hidden md:flex gap-2">
          {[
            { key: "apply", label: "Apply" },
            { key: "loans", label: "My Loans" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                tab === t.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "apply" ? (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            <LoanForm onAddLoan={handleNewLoan} />
          </div>
        ) : loading ? (
          <p className="text-slate-500">Loading your loans...</p>
        ) : (
          <LoanTracker loans={loans} editable={false} />
        )}

        <p className="text-sm text-slate-500">
          Need help?{" "}
          <Link to="/Terms-Conditions.pdf" className="text-indigo-600 underline">
            Terms &amp; Conditions
          </Link>
        </p>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 z-50">
        <button
          onClick={() => setTab("apply")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "apply" ? "text-indigo-600" : "text-slate-500"
          }`}
        >
          📝 Apply
        </button>
        <button
          onClick={() => setTab("loans")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "loans" ? "text-indigo-600" : "text-slate-500"
          }`}
        >
          📄 My Loans
        </button>
      </nav>
    </div>
  );
}
