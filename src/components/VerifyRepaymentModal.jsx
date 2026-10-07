import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { updateTransactionStatus } from "../api/paymentTracking";
import { logLoanEvent } from "../api/loanDecisions";

export default function VerifyRepaymentModal({ loan, onClose, onDone }) {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const due = Number(loan?.total_repayment || 0);

  useEffect(() => {
    if (!loan?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("loan_transactions")
        .select("*")
        .eq("loan_id", loan.id)
        .eq("type", "repayment")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setTransaction(data);
      setLoading(false);
    };
    load();
  }, [loan?.id]);

  const confirm = async () => {
    if (!transaction) return;
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      await updateTransactionStatus({ id: transaction.id, status: "confirmed", confirmedBy: user.id });
      await supabase
        .from("loan_applications")
        .update({
          status: "repaid",
          settlement_method: "cash",
          settled_at: new Date().toISOString(),
          settled_by: user.id,
          admin_seen: true,
        })
        .eq("id", loan.id);
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "admin",
        actorId: user.id,
        action: "repayment_confirmed",
        fromStatus: "repayment_pending",
        toStatus: "repaid",
        message: `Admin confirmed repayment ref ${transaction.reference_number}`,
      });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async () => {
    if (!transaction) return;
    if (!rejectReason.trim()) return setError("Reason required.");
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      await updateTransactionStatus({ id: transaction.id, status: "rejected", confirmedBy: user.id });
      await supabase
        .from("loan_applications")
        .update({ status: "active", admin_seen: false, borrower_message: rejectReason.trim() })
        .eq("id", loan.id);
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "admin",
        actorId: user.id,
        action: "repayment_rejected",
        fromStatus: "repayment_pending",
        toStatus: "active",
        message: rejectReason.trim(),
      });
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const paid = Number(transaction?.amount || 0);
  const short = paid > 0 && paid < due;

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-800">Verify Repayment</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !transaction ? (
          <p className="text-sm text-slate-500">No repayment submission yet.</p>
        ) : (
          <>
            <div className="space-y-1 text-sm">
              <p>Reference: <span className="font-mono font-semibold">{transaction.reference_number}</span></p>
              <p>Channel: {transaction.payment_method}</p>
              <p>Amount: Mkw {paid.toLocaleString()}</p>
              {short && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-xs">
                  ⚠️ Short payment: {paid.toLocaleString()} of {due.toLocaleString()}
                </p>
              )}
              {transaction.proof_url && (
                <ProofPreview path={transaction.proof_url} />
              )}
            </div>

            {!showReject ? (
              <>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowReject(true)} className="flex-1 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-semibold">Reject</button>
                  <button disabled={submitting} onClick={confirm} className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">{submitting ? "Confirming…" : "Confirm"}</button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (required)" className="w-full border rounded px-3 py-2 text-sm" />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowReject(false)} className="flex-1 py-2 rounded-xl border border-slate-300 text-sm">Back</button>
                  <button disabled={submitting} onClick={reject} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Send rejection</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProofPreview({ path }) {
  const [url, setUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.storage.from("proofs").createSignedUrl(path, 3600);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setError("Could not load proof.");
      } else {
        setUrl(data.signedUrl);
        setIsPdf(path.toLowerCase().endsWith(".pdf"));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!url) return <p className="text-xs text-slate-400">Loading proof…</p>;
  return (
    <div className="border rounded-xl overflow-hidden bg-slate-50">
      {isPdf ? <iframe src={url} className="w-full h-40" title="proof" /> : <img src={url} className="w-full object-contain max-h-40" alt="proof" />}
    </div>
  );
}
