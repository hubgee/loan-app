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
  const [activeLoan, setActiveLoan] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setLoans((data || []).map(mapRow));

    // Check for active loan (pending or approved)
    const { data: active } = await supabase
      .from("loan_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved"])
      .maybeSingle();

    setActiveLoan(active);
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
          ].map((t) => {
            const disabled = t.key === "apply" && activeLoan;
            return (
              <button
                key={t.key}
                onClick={() => {
                  if (disabled) return;
                  setTab(t.key);
                }}
                disabled={disabled}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-indigo-600 text-white"
                    : disabled
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
                title={
                  disabled
                    ? activeLoan.status === "pending"
                      ? "Repay your pending loan to apply for another"
                      : "Repay your active loan to apply for another"
                    : undefined
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "apply" ? (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            {activeLoan ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {activeLoan.status === "pending"
                    ? "Loan Pending Approval"
                    : "Active Loan"}
                </h3>
                <p className="text-slate-600 mb-4 max-w-md mx-auto">
                  {activeLoan.status === "pending"
                    ? "Your loan application is currently under review. Once approved and repaid, you'll be eligible to apply for a new loan with an increased limit."
                    : "You have an active loan that needs to be repaid first. Timely repayment builds your creditworthiness and unlocks higher loan limits for future applications."}
                </p>
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                  <p className="font-medium">Current status: {activeLoan.status === "pending" ? "Pending approval" : "Active — repayment required"}</p>
                </div>
              </div>
            ) : (
              <LoanForm onAddLoan={handleNewLoan} />
            )}
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
          onClick={() => {
            if (activeLoan) return;
            setTab("apply");
          }}
          disabled={activeLoan}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "apply"
              ? "text-indigo-600"
              : activeLoan
              ? "text-slate-400"
              : "text-slate-500"
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
