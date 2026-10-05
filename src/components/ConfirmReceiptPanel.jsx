import { useState } from "react";
import { supabase } from "../api/supabaseClient";
import { logLoanEvent } from "../api/loanDecisions";

export default function ConfirmReceiptPanel({ loan, onDone }) {
  const [reporting, setReporting] = useState(false);
  const [issueMessage, setIssueMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const confirmReceived = async () => {
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          status: "active",
          admin_seen: false,
          borrower_message: null,
          borrower_decided_at: new Date().toISOString(),
        })
        .eq("id", loan.id)
        .eq("status", "disbursement_pending");
      if (loanError) throw loanError;
      const { error: txError } = await supabase
        .from("loan_transactions")
        .update({ status: "confirmed", confirmed_by: user.id, confirmed_at: new Date().toISOString() })
        .eq("loan_id", loan.id)
        .eq("type", "disbursement")
        .eq("status", "pending_confirmation");
      if (txError) throw txError;
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "borrower",
        actorId: user.id,
        action: "receipt_confirmed",
        fromStatus: "disbursement_pending",
        toStatus: "active",
        message: "Borrower confirmed receipt of disbursement",
      });
      onDone?.();
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const reportIssue = async () => {
    if (!issueMessage.trim()) return setError("Please describe the issue.");
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({ admin_seen: false, borrower_message: issueMessage.trim() })
        .eq("id", loan.id)
        .eq("status", "disbursement_pending");
      if (loanError) throw loanError;
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "borrower",
        actorId: user.id,
        action: "issue_reported",
        fromStatus: "disbursement_pending",
        toStatus: "disbursement_pending",
        message: issueMessage.trim(),
      });
      setReporting(false);
      setIssueMessage("");
      onDone?.();
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-900">
        Admin marked funds as sent. Did you receive them?
      </p>
      {!reporting ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button disabled={submitting} onClick={confirmReceived} className="py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50">
            {submitting ? "Confirming…" : "✓ I received it"}
          </button>
          <button disabled={submitting} onClick={() => setReporting(true)} className="py-3 rounded-xl bg-white border border-blue-300 text-blue-700 font-semibold disabled:opacity-50">
            ⚠ Report issue
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea value={issueMessage} onChange={(e) => setIssueMessage(e.target.value)} placeholder="e.g. Funds not reflected yet / Received incorrect amount" className="w-full border rounded px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setReporting(false)} className="flex-1 py-2 rounded-xl border border-slate-300 text-sm">Back</button>
            <button disabled={submitting} onClick={reportIssue} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Send to admin</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
