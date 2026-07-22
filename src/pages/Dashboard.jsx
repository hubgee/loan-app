// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import LoanTracker from "../components/LoanTracker";
import { supabase, isAdmin } from "../api/supabaseClient";

export default function Dashboard() {
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
      }));

      setLoans(applications);
      setStats({
        total: applications.length,
        pending: applications.filter((l) => l.status === "Pending").length,
        approved: applications.filter((l) => l.status === "Approved").length,
        repaid: applications.filter((l) => l.status === "Repaid").length,
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
    if (!user || !isAdmin(user)) {
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
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

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
