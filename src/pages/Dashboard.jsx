// src/pages/Dashboard.jsx

import LoanTracker from "../components/LoanTracker";

export default function Dashboard({ loans, onUpdateLoan }) {
  const totalLoans = loans.length;
  const pendingLoans = loans.filter((l) => l.status === "Pending").length;
  const approvedLoans = loans.filter((l) => l.status === "Approved").length;
  const repaidLoans = loans.filter((l) => l.status === "Repaid").length;

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{totalLoans}</p>
          <p className="text-gray-600">Total Loans</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{pendingLoans}</p>
          <p className="text-gray-600">Pending</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{approvedLoans}</p>
          <p className="text-gray-600">Approved</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{repaidLoans}</p>
          <p className="text-gray-600">Repaid</p>
        </div>
      </div>

      {/* Loan tracker */}
      <LoanTracker loans={loans} onUpdateLoan={onUpdateLoan} />
    </div>
  );
}
