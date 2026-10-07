import { useState } from "react";
import { supabase } from "../api/supabaseClient";
import { logLoanEvent } from "../api/loanDecisions";
import { COLLATERAL_LABELS } from "../api/collateral";

export default function ForfeitCollateralModal({ loan, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = Number(loan?.total_repayment || 0);
  const colVal = Number(loan?.collateral_value || 0);
  const shortfall = Math.max(0, total - colVal);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return setError("Please give a short reason so admin knows why.");
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
          status: "forfeiture_pending",
          forfeiture_reason: reason.trim(),
          forfeiture_requested_at: now,
          borrower_message: reason.trim(),
          borrower_decided_at: now,
          admin_seen: false,
        })
        .eq("id", loan.id)
        .eq("status", "active");
      if (loanError) throw loanError;
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "borrower",
        actorId: user.id,
        action: "forfeiture_requested",
        fromStatus: "active",
        toStatus: "forfeiture_pending",
        message: reason.trim(),
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-800">Forfeit collateral</h3>
        <p className="text-sm text-slate-600">
          You are offering your collateral instead of a cash repayment. An admin must approve
          before the loan is closed.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
          <p>
            Collateral:{" "}
            <span className="font-medium">
              {COLLATERAL_LABELS[loan?.collateral_type] ?? loan?.collateral_type ?? "—"}
            </span>{" "}
            • Mwk {colVal.toLocaleString()}
          </p>
          <p>Total due: Mwk {total.toLocaleString()}</p>
          {shortfall > 0 ? (
            <p className="text-amber-700">
              ⚠️ Shortfall of Mwk {shortfall.toLocaleString()} will still be owed after forfeit.
            </p>
          ) : (
            <p className="text-green-700">✅ Collateral covers the total due.</p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            Why can&apos;t you repay in cash? (required)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Business did not pick up this month, I cannot raise the cash"
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-300 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Request forfeiture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
