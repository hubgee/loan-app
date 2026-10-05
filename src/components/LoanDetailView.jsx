import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

const STATUS_PILL = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  confirmed: "bg-blue-100 text-blue-800",
  disbursement_pending: "bg-purple-100 text-purple-800",
  active: "bg-indigo-100 text-indigo-800",
  repayment_pending: "bg-yellow-100 text-yellow-800",
  edit_requested: "bg-orange-100 text-orange-800",
  cancelled: "bg-slate-200 text-slate-700",
  repaid: "bg-indigo-100 text-indigo-800",
};

const STATUS_PROGRESS = {
  pending: "20%",
  approved: "50%",
  edit_requested: "60%",
  confirmed: "65%",
  disbursement_pending: "75%",
  active: "85%",
  repayment_pending: "92%",
  cancelled: "100%",
  repaid: "100%",
};

const DURATION_LABELS = {
  "1_week": "1 Week",
  "2_weeks": "2 Weeks",
  "1_month": "1 Month",
};

const PAYOUT_PROVIDER_LABELS = {
  airtel_money: "Airtel Money",
  tnm_mpamba: "TNM Mpamba",
  fdh: "FDH Bank",
  national_bank: "National Bank of Malawi",
  standard_bank: "Standard Bank",
};

function formatDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LoanDetailView({ loan, index, total, onClose, onPrev, onNext, onAdminAction, acting }) {
  const [idUrl, setIdUrl] = useState(null);
  const [idLoading, setIdLoading] = useState(false);
  const [idError, setIdError] = useState("");
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    if (!loan?.national_id_path) {
      setIdUrl(null);
      return;
    }
    setIdLoading(true);
    setIdError("");
    const load = async () => {
      const { data, error } = await supabase.storage
        .from("ids")
        .createSignedUrl(loan.national_id_path, 3600);
      if (error) {
        setIdError("Could not load ID document.");
        setIdUrl(null);
      } else {
        setIdUrl(data.signedUrl);
        setIsPdf(
          loan.national_id_original?.toLowerCase().endsWith(".pdf") ||
            loan.national_id_path.toLowerCase().endsWith(".pdf")
        );
      }
      setIdLoading(false);
    };
    load();
  }, [loan?.national_id_path, loan?.national_id_original]);

  if (!loan) return null;

  const payoutProviderLabel =
    PAYOUT_PROVIDER_LABELS[loan.payout_provider] ?? loan.payout_provider ?? "—";

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto">
      <div className="bg-white w-full md:max-w-5xl md:p-6 p-4 md:rounded-2xl rounded-t-2xl space-y-4 mt-8 md:mt-0">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500">
              Loan {index + 1} of {total}
            </p>
            <h3 className="text-xl font-bold text-slate-900">
              {loan.name} — {loan.id}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 text-xl px-2 md:hidden" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Desktop close button */}
        <button onClick={onClose} className="hidden md:block absolute top-4 right-4 text-slate-500">
          ✕
        </button>

        {/* Status */}
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_PILL[loan.status] ?? "bg-slate-200 text-slate-700"}`}>
            {loan.status.replace("_", " ").toUpperCase()}
          </span>
          {loan.admin_seen === false && (
            <span className="text-xs text-red-600 font-semibold">● Needs review</span>
          )}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: STATUS_PROGRESS[loan.status] ?? "25%" }} />
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Application details */}
          <div className="space-y-4">
            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Borrower</h4>
              <p className="text-sm">Name: <span className="font-medium">{loan.name}</span></p>
              <p className="text-sm">Email: {loan.email || "—"}</p>
              <p className="text-sm">Phone: {loan.phone || "—"}</p>
              <p className="text-sm">Purpose: {loan.purpose || "—"}</p>
            </section>

            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Loan</h4>
              <p className="text-sm">Amount: Mkw {Number(loan.amount).toLocaleString()}</p>
              <p className="text-sm">Duration: {DURATION_LABELS[loan.duration] ?? loan.duration}</p>
              <p className="text-sm">Interest: Mkw {Number(loan.interest_amount).toLocaleString()}</p>
              <p className="text-sm">Total repayment: Mkw {Number(loan.total_repayment).toLocaleString()}</p>
              <p className="text-sm">Due date: {formatDate(loan.repayment_date)}</p>
            </section>

            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Payout details</h4>
              {loan.payout_method ? (
                <>
                  <p className="text-sm">Method: {loan.payout_method === "bank" ? "Bank" : "Mobile Money"}</p>
                  <p className="text-sm">Provider: {payoutProviderLabel}</p>
                  <p className="text-sm">Account name: {loan.payout_account_name}</p>
                  <p className="text-sm">Account number: {loan.payout_account_number}</p>
                  {loan.payout_method === "bank" && (
                    <p className="text-sm">Branch: {loan.payout_branch || "—"}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">No payout details recorded.</p>
              )}
            </section>

            {loan.borrower_message && (
              <section className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <h4 className="text-xs font-bold text-orange-700 uppercase tracking-wide">Borrower message</h4>
                <p className="text-sm text-orange-900">“{loan.borrower_message}”</p>
              </section>
            )}

            {/* Admin actions */}
            <section className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</h4>
              <div className="flex flex-wrap gap-2">
                {loan.status === "pending" && (
                  <button disabled={acting === loan.id} onClick={() => onAdminAction("approve", loan)} className="px-4 py-2 rounded-full text-sm bg-green-600 text-white disabled:opacity-50">
                    Approve
                  </button>
                )}
                {loan.status === "edit_requested" && (
                  <button disabled={acting === loan.id} onClick={() => onAdminAction("reapprove", loan)} className="px-4 py-2 rounded-full text-sm bg-green-600 text-white disabled:opacity-50">
                    Accept edits → re-approve
                  </button>
                )}
                {loan.status === "confirmed" && (
                  <button disabled={acting === loan.id} onClick={() => onAdminAction("disburse", loan)} className="px-4 py-2 rounded-full text-sm bg-blue-600 text-white disabled:opacity-50">
                    Disburse funds
                  </button>
                )}
                {loan.status === "disbursement_pending" && (
                  <span className="px-4 py-2 rounded-full text-sm bg-purple-100 text-purple-700">
                    Waiting for borrower receipt
                  </span>
                )}
                {loan.status === "active" && (
                  <span className="px-4 py-2 rounded-full text-sm bg-indigo-100 text-indigo-700">
                    Active — waiting for repayment
                  </span>
                )}
                {loan.status === "repayment_pending" && (
                  <button disabled={acting === loan.id} onClick={() => onAdminAction("verify_repayment", loan)} className="px-4 py-2 rounded-full text-sm bg-indigo-600 text-white disabled:opacity-50">
                    Verify repayment
                  </button>
                )}
                {loan.admin_seen === false && (
                  <button disabled={acting === loan.id} onClick={() => onAdminAction("acknowledge", loan)} className="px-4 py-2 rounded-full text-sm bg-white border border-slate-300 text-slate-700 disabled:opacity-50">
                    Mark reviewed
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* Right: National ID */}
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">National ID</h4>
            {loan.national_id_original && (
              <p className="text-xs text-slate-500">{loan.national_id_original}</p>
            )}

            {idLoading && <p className="text-sm text-slate-500">Loading document…</p>}
            {idError && <p className="text-sm text-red-600">{idError}</p>}

            {idUrl && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                {isPdf ? (
                  <iframe
                    src={idUrl}
                    title="National ID PDF"
                    className="w-full h-80 md:h-[28rem]"
                  />
                ) : (
                  <img
                    src={idUrl}
                    alt="National ID"
                    className="w-full object-contain max-h-[28rem]"
                  />
                )}
              </div>
            )}

            {idUrl && (
              <a href={idUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-indigo-600 underline mt-1">
                Open in new tab
              </a>
            )}

            {!loan.national_id_path && (
              <p className="text-sm text-slate-500">No ID document uploaded.</p>
            )}
          </section>
        </div>

        {/* Prev / Next */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            disabled={index === 0}
            onClick={() => onPrev()}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500">
            {index + 1} / {total}
          </span>
          <button
            disabled={index === total - 1}
            onClick={() => onNext()}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
