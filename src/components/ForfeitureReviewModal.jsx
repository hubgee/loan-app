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
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-800">Review forfeiture request</h3>
        <div className="space-y-1 text-sm">
          <p>
            Borrower: <span className="font-medium">{loan?.name}</span>
          </p>
          <p>Total due: Mwk {total.toLocaleString()}</p>
          <p>
            Collateral: {COLLATERAL_LABELS[loan?.collateral_type] ?? "—"} • Mwk{" "}
            {colVal.toLocaleString()}
          </p>
          <p className="text-slate-600">{loan?.collateral_description || "No description."}</p>
          {shortfall > 0 ? (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-xs">
              ⚠️ Shortfall Mwk {shortfall.toLocaleString()} will remain owed after forfeit.
              {loan?.shortfall_acknowledged ? " Borrower acknowledged this at submission." : ""}
            </p>
          ) : (
            <p className="text-green-700 bg-green-50 border border-green-200 rounded p-2 text-xs">
              ✅ Covers total. Surplus Mwk {surplus.toLocaleString()} returnable on forfeit.
            </p>
          )}
          {loan?.forfeiture_reason && (
            <p className="text-slate-700 bg-orange-50 border border-orange-200 rounded p-2 text-xs">
              Borrower reason: “{loan.forfeiture_reason}”
            </p>
          )}
        </div>

        {!showDecline ? (
          <>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDecline(true)}
                className="flex-1 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-semibold"
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
              className="w-full border rounded px-3 py-2 text-sm"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDecline(false)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-sm"
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
        <button onClick={onClose} className="w-full py-2 text-sm text-slate-500">
          Close
        </button>
      </div>
    </div>
  );
}
