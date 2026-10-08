import { useState } from "react";
import { supabase } from "../api/supabaseClient";
import { logLoanEvent } from "../api/loanDecisions";
import { COLLATERAL_LABELS } from "../api/collateral";

export default function ForfeitureReviewModal({ loan, onClose, onDone }) {
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = Number(loan?.total_repayment || 0);
  const colVal = Number(loan?.collateral_value || 0);
  const shortfall = Math.max(0, total - colVal);
  const surplus = Math.max(0, colVal - total);

  const approve = async () => {
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      const now = new Date().toISOString();
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          status: "forfeited",
          settlement_method: "collateral_forfeit",
          settled_at: now,
          settled_by: user.id,
          forfeiture_approved_at: now,
          shortfall_outstanding: shortfall,
          admin_seen: true,
        })
        .eq("id", loan.id)
        .eq("status", "forfeiture_pending");
      if (loanError) throw loanError;
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "admin",
        actorId: user.id,
        action: "forfeiture_approved",
        fromStatus: "forfeiture_pending",
        toStatus: "forfeited",
        message:
          shortfall > 0
            ? `Collateral forfeited. Shortfall Mwk ${shortfall.toLocaleString()} still owed.`
            : "Collateral forfeited. Covered in full.",
      });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    if (!declineReason.trim()) return setError("Reason required.");
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      const now = new Date().toISOString();
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          status: "active",
          forfeiture_declined_at: now,
          borrower_message: declineReason.trim(),
          admin_seen: false,
        })
        .eq("id", loan.id)
        .eq("status", "forfeiture_pending");
      if (loanError) throw loanError;
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "admin",
        actorId: user.id,
        action: "forfeiture_declined",
        fromStatus: "forfeiture_pending",
        toStatus: "active",
        message: declineReason.trim(),
      });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-slate-800 w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Review forfeiture request</h3>
        <div className="space-y-1 text-sm">
          <p className="text-slate-700 dark:text-slate-300">
            Borrower: <span className="font-medium text-slate-900 dark:text-slate-100">{loan?.name}</span>
          </p>
          <p className="text-slate-700 dark:text-slate-300">Total due: Mwk {total.toLocaleString()}</p>
          <p className="text-slate-700 dark:text-slate-300">
            Collateral: {COLLATERAL_LABELS[loan?.collateral_type] ?? "—"} • Mwk{" "}
            {colVal.toLocaleString()}
          </p>
          <p className="text-slate-600 dark:text-slate-400">{loan?.collateral_description || "No description."}</p>
          {shortfall > 0 ? (
            <p className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded p-2 text-xs">
              ⚠️ Shortfall Mwk {shortfall.toLocaleString()} will remain owed after forfeit.
              {loan?.shortfall_acknowledged ? " Borrower acknowledged this at submission." : ""}
            </p>
          ) : (
            <p className="text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded p-2 text-xs">
              ✅ Covers total. Surplus Mwk {surplus.toLocaleString()} returnable on forfeit.
            </p>
          )}
          {loan?.forfeiture_reason && (
            <p className="text-slate-700 dark:text-slate-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded p-2 text-xs">
              Borrower reason: “{loan.forfeiture_reason}”
            </p>
          )}
        </div>

        {!showDecline ? (
          <>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDecline(true)}
                className="flex-1 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm font-semibold"
              >
                Decline
              </button>
              <button
                disabled={submitting}
                onClick={approve}
                className="flex-1 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "Approving…" : "Approve forfeiture"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining (required)"
              className="w-full border dark:border-slate-700 rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDecline(false)}
                className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              >
                Back
              </button>
              <button
                disabled={submitting}
                onClick={decline}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                Send decline
              </button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="w-full py-2 text-sm text-slate-500 dark:text-slate-400">
          Close
        </button>
      </div>
    </div>
  );
}
