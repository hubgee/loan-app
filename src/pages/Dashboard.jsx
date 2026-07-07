// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import LoanTracker from "../components/LoanTracker";
import { api, getCsrf } from "../api/client";

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
      const res = await api.get("/loans");
      setLoans(res.data.applications);
      setStats(res.data.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateLoan = async (id, updatedLoan) => {
    await getCsrf();
    await api.patch(`/loans/${id}`, { status: updatedLoan.status });
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
