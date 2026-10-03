// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoanTracker from "../components/LoanTracker";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../auth/useAuth";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    repaid: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const applications = (data || []).map((l) => ({
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
        payout_method: l.payout_method,
        payout_provider: l.payout_provider,
        payout_account_name: l.payout_account_name,
        payout_account_number: l.payout_account_number,
        payout_branch: l.payout_branch,
      }));

      setLoans(applications);
      setStats({
        total: applications.length,
        pending: applications.filter((l) => l.status === "pending").length,
        approved: applications.filter((l) => l.status === "approved").length,
        repaid: applications.filter((l) => l.status === "repaid").length,
      });
    } catch (err) {
      console.error("Failed to load loans", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load() is async; state updates happen after an await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const updateLoan = async (id, updatedLoan) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdmin) {
      throw new Error("Not authorized.");
    }

    const { error } = await supabase
      .from("loan_applications")
      .update({
        status: updatedLoan.status,
        processed_by: user.id,
      })
      .eq("id", id);
    if (error) throw error;

    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: updatedLoan.status } : l))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <Link
          to="/admin/users"
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 w-fit"
        >
          Manage users
        </Link>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-gray-600">Total Loans</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.pending}</p>
          <p className="text-gray-600">Pending</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.approved}</p>
          <p className="text-gray-600">Approved</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.repaid}</p>
          <p className="text-gray-600">Repaid</p>
        </div>
      </div>

      {/* Loan tracker */}
      <LoanTracker loans={loans} onUpdateLoan={updateLoan} />
    </div>
  );
}
