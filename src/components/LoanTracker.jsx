// src/components/LoanTracker.jsx

import { useState } from "react";

const DURATION_LABELS = {
  "1_week": "1 Week",
  "2_weeks": "2 Weeks",
  "1_month": "1 Month",
};

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  repaid: "bg-indigo-100 text-indigo-700",
};

const STATUS_PROGRESS = {
  pending: "25%",
  approved: "75%",
  repaid: "100%",
};

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  repaid: "Repaid",
};

const PAYOUT_PROVIDER_LABELS = {
  airtel_money: "Airtel Money",
  tnm_mpamba: "TNM Mpamba",
  fdh: "FDH Bank",
  national_bank: "National Bank of Malawi",
  standard_bank: "Standard Bank",
};

function payoutSummary(loan) {
  if (!loan?.payout_method) return null;
  const provider =
    PAYOUT_PROVIDER_LABELS[loan.payout_provider] ?? loan.payout_provider;
  if (loan.payout_method === "mobile_money") {
    return `${provider} • ${loan.payout_account_number ?? ""} (${loan.payout_account_name ?? ""})`;
  }
  return `${provider} • Acct ${loan.payout_account_number ?? ""} (${loan.payout_account_name ?? ""})${loan.payout_branch ? ` • ${loan.payout_branch}` : ""}`;
}

export default function LoanTracker({ loans, onUpdateLoan, editable = true }) {
  const [filter, setFilter] = useState("all");

  const filteredLoans =
    filter === "all" ? loans : loans.filter((loan) => loan.status === filter);

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-bold text-slate-800">Loan Tracker</h2>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "approved", "repaid"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-full text-sm ${
              filter === status
                ? "bg-indigo-600 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {status === "all" ? "All" : STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {filteredLoans.length === 0 ? (
        <p className="text-slate-500">No loans match this filter.</p>
      ) : (
        filteredLoans.map((loan) => (
          <div
            key={loan.id ?? `${loan.name}-${loan.amount}`}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2"
          >
            {/* Borrower name */}
            <p className="font-semibold text-slate-800">
              {loan.name ?? loan.borrower_name}
            </p>

            {/* Loan amount */}
            <p className="text-slate-600">Amount: Mkw {loan.amount}</p>

            {/* Duration */}
            <p className="text-slate-600">
              Duration: {DURATION_LABELS[loan.duration] || loan.duration}
            </p>

            {/* Interest */}
            <p className="text-slate-600">Interest: Mkw {loan.interest_amount}</p>

            {/* Total repayment */}
            <p className="text-slate-600">
              Total repayment: Mkw {loan.total_repayment}
            </p>

            {/* Repayment date */}
            <p className="text-slate-600">Due: {loan.repayment_date}</p>

            {/* Payout / disbursement details */}
            {loan.payout_method && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm">
                <p className="font-medium text-slate-700">
                  {loan.payout_method === "bank" ? "🏦 Bank payout" : "📱 Mobile money payout"}
                </p>
                <p className="text-slate-600">{payoutSummary(loan)}</p>
              </div>
            )}

            {/* Status: badge for borrowers, dropdown for admins */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Status:</span>
              {editable && onUpdateLoan ? (
                <select
                  value={loan.status}
                  onChange={(e) =>
                    onUpdateLoan(loan.id, { ...loan, status: e.target.value })
                  }
                  className="border border-slate-200 rounded px-2 py-1 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="repaid">Repaid</option>
                </select>
              ) : (
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    STATUS_STYLES[loan.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {STATUS_LABELS[loan.status] ?? loan.status}
                </span>
              )}
            </div>

            {/* Repayment progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: STATUS_PROGRESS[loan.status] ?? "25%" }}
              ></div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
