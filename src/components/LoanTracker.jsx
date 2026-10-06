// src/components/LoanTracker.jsx

import { useState } from "react";
import LoanTimeline from "./LoanTimeline";
import CollateralGallery from "./CollateralGallery";
import RepaymentCountdown from "./RepaymentCountdown";
import { COLLATERAL_LABELS } from "../api/collateral";

function CollateralSummary({ loan }) {
  const principal = Number(loan.amount || 0);
  const total = Number(loan.total_repayment || 0);
  const val = Number(loan.collateral_value || 0);
  const shortfall = Number(loan.collateral_shortfall ?? Math.max(0, total - val));
  const covers = total > 0 && val >= total;
  return (
    <div className="space-y-1">
      <p className="text-slate-600">
        {COLLATERAL_LABELS[loan.collateral_type] ?? loan.collateral_type ?? "—"} • Mwk {val.toLocaleString()}
      </p>
      <p className={covers ? "text-green-700" : "text-amber-700"}>
        {covers ? `Covers total (+Mwk ${(val - total).toLocaleString()} surplus)` : `Shortfall Mwk ${shortfall.toLocaleString()} after forfeit`}
      </p>
      <CollateralGallery loanId={loan.id} compact />
    </div>
  );
}

const DURATION_LABELS = {
  "1_week": "1 Week",
  "2_weeks": "2 Weeks",
  "1_month": "1 Month",
};

export const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  confirmed: "bg-blue-100 text-blue-700",
  disbursement_pending: "bg-purple-100 text-purple-700",
  active: "bg-indigo-100 text-indigo-700",
  repayment_pending: "bg-yellow-100 text-yellow-700",
  edit_requested: "bg-orange-100 text-orange-700",
  cancelled: "bg-slate-200 text-slate-600",
  repaid: "bg-indigo-100 text-indigo-700",
};

export const STATUS_PROGRESS = {
  pending: "20%",
  approved: "50%",
  confirmed: "60%",
  disbursement_pending: "70%",
  active: "80%",
  repayment_pending: "90%",
  edit_requested: "60%",
  cancelled: "100%",
  repaid: "100%",
};

export const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  confirmed: "Confirmed",
  disbursement_pending: "Disbursement pending",
  active: "Active",
  repayment_pending: "Repayment pending",
  edit_requested: "Edit requested",
  cancelled: "Cancelled",
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

export default function LoanTracker({
  loans,
  onUpdateLoan,
  onAdminAction,
  editable = true,
  showTimeline = false,
  onViewDetail,
}) {
  const filteredLoans = loans;

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-bold text-slate-800">Loan Tracker</h2>

      {filteredLoans.length === 0 ? (
        <p className="text-slate-500">No loans match this filter.</p>
      ) : (
        filteredLoans.map((loan) => (
          <div
            key={loan.id ?? `${loan.name}-${loan.amount}`}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800">
                {loan.name ?? loan.borrower_name}
              </p>
              {loan.admin_seen === false && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">
                  ● Needs review
                </span>
              )}
            </div>

            <p className="text-slate-600">Amount: Mkw {loan.amount}</p>
            <p className="text-slate-600">
              Duration: {DURATION_LABELS[loan.duration] || loan.duration}
            </p>
            <p className="text-slate-600">Interest: Mkw {loan.interest_amount}</p>
            <p className="text-slate-600">
              Total repayment: Mkw {loan.total_repayment}
            </p>
            <p className="text-slate-600">Due: {loan.repayment_date}</p>
            <RepaymentCountdown loan={loan} compact />

            {loan.payout_method && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm">
                <p className="font-medium text-slate-700">
                  {loan.payout_method === "bank" ? "🏦 Bank payout" : "📱 Mobile money payout"}
                </p>
                <p className="text-slate-600">{payoutSummary(loan)}</p>
              </div>
            )}

            {loan.borrower_message && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-sm">
                <p className="font-medium text-orange-800">Borrower note:</p>
                <p className="text-orange-900">“{loan.borrower_message}”</p>
              </div>
            )}

            {(loan.collateral_type || loan.collateral_value) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm">
                <p className="font-medium text-slate-700">Collateral</p>
                <CollateralSummary loan={loan} />
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
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
                  <option value="confirmed">Confirmed</option>
                  <option value="disbursement_pending">Disbursement pending</option>
                  <option value="active">Active</option>
                  <option value="repayment_pending">Repayment pending</option>
                  <option value="edit_requested">Edit requested</option>
                  <option value="cancelled">Cancelled</option>
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
              {onAdminAction && (
                <span className="flex gap-2 flex-wrap">
                  {loan.status === "pending" && (
                    <button onClick={() => onAdminAction("approve", loan)} className="px-3 py-1 rounded-full text-xs bg-green-600 text-white">
                      Approve
                    </button>
                  )}
                  {loan.status === "confirmed" && (
                    <button onClick={() => onAdminAction("disburse", loan)} className="px-3 py-1 rounded-full text-xs bg-blue-600 text-white">
                      Disburse funds
                    </button>
                  )}
                  {loan.status === "disbursement_pending" && (
                    <span className="px-3 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                      Waiting for borrower receipt
                    </span>
                  )}
                  {loan.status === "active" && (
                    <span className="px-3 py-1 rounded-full text-xs bg-indigo-100 text-indigo-700">
                      Active — waiting for repayment
                    </span>
                  )}
                  {loan.status === "repayment_pending" && (
                    <button onClick={() => onAdminAction("verify_repayment", loan)} className="px-3 py-1 rounded-full text-xs bg-indigo-600 text-white">
                      Verify repayment
                    </button>
                  )}
                  {loan.status === "edit_requested" && (
                    <button onClick={() => onAdminAction("reapprove", loan)} className="px-3 py-1 rounded-full text-xs bg-green-600 text-white">
                      Accept edits → re-approve
                    </button>
                  )}
                  {loan.admin_seen === false && (
                    <button onClick={() => onAdminAction("acknowledge", loan)} className="px-3 py-1 rounded-full text-xs bg-white border border-slate-300 text-slate-700">
                      Mark reviewed
                    </button>
                  )}
                </span>
              )}
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: STATUS_PROGRESS[loan.status] ?? "25%" }}
              ></div>
            </div>

            {onViewDetail && (
              <button
                onClick={() => onViewDetail(loan.id)}
                className="w-full md:w-auto px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
              >
                View full application + ID
              </button>
            )}

            {showTimeline && loan.id && (
              <details className="text-sm">
                <summary className="cursor-pointer text-indigo-600 text-xs font-medium">View history</summary>
                <LoanTimeline loanId={loan.id} />
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}
