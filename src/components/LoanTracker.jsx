// src/components/LoanTracker.jsx

import { useState } from "react";

export default function LoanTracker({ loans, onUpdateLoan }) {
  const [filter, setFilter] = useState("All");

  const filteredLoans =
    filter === "All" ? loans : loans.filter((loan) => loan.status === filter);

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-bold">Loan Tracker</h2>

      {/* Filter buttons */}
      <div className="flex gap-2">
        {["All", "Pending", "Approved", "Repaid"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 rounded text-sm ${
              filter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {filteredLoans.length === 0 ? (
        <p className="text-gray-500">No loans match this filter.</p>
      ) : (
        filteredLoans.map((loan, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-lg shadow-md space-y-2"
          >
            {/* Borrower name */}
            <p className="font-semibold">{loan.name}</p>

            {/* Loan amount */}
            <p>Amount: Mkw {loan.amount}</p>

            {/* Status dropdown */}
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <select
                value={loan.status}
                onChange={(e) =>
                  onUpdateLoan(i, { ...loan, status: e.target.value })
                }
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Repaid">Repaid</option>
              </select>
            </div>

            {/* Repayment progress bar (example: 50%) */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: "50%" }}
              ></div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
