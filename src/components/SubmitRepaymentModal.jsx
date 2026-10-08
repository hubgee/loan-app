import { useState } from "react";
import { createTransaction } from "../api/paymentTracking";
import { supabase } from "../api/supabaseClient";
import { logLoanEvent } from "../api/loanDecisions";

const CHANNEL_OPTIONS = [
  { value: "airtel_money", label: "Airtel Money" },
  { value: "tnm_mpamba", label: "TNM Mpamba" },
  { value: "fdh", label: "FDH Bank" },
  { value: "national_bank", label: "National Bank of Malawi" },
  { value: "standard_bank", label: "Standard Bank" },
];

export default function SubmitRepaymentModal({ loan, onClose, onDone }) {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("airtel_money");
  const [amount, setAmount] = useState(loan?.total_repayment ?? "");
  const [senderPhone, setSenderPhone] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const due = Number(loan?.total_repayment || 0);
  const paid = Number(amount || 0);
  const short = paid > 0 && paid < due;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!referenceNumber.trim()) return setError("Reference number is required.");
    if (!amount) return setError("Amount is required.");
    setSubmitting(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not signed in.");
      await createTransaction({
        loanId: loan.id,
        type: "repayment",
        referenceNumber: referenceNumber.trim(),
        paymentMethod,
        amount: paid,
        proofFile,
        submittedBy: user.id,
      });
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({ status: "repayment_pending", admin_seen: false, borrower_message: `Repayment ref ${referenceNumber}${senderPhone ? ` from ${senderPhone}` : ""}` })
        .eq("id", loan.id)
        .eq("status", "active");
      if (loanError) throw loanError;
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "borrower",
        actorId: user.id,
        action: "repayment_submitted",
        fromStatus: "active",
        toStatus: "repayment_pending",
        message: `Repayment of ${paid.toLocaleString()} via ${paymentMethod}. Ref: ${referenceNumber}`,
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
      <div className="bg-white dark:bg-slate-800 w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Submit Repayment</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Enter details from your mobile money / bank receipt so admin can verify.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Reference / Transaction ID</label>
          <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full border dark:border-slate-700 rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. MP241004.0900.B67890" required />

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Channel used</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border dark:border-slate-700 rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Sender phone / account name (for cross-check)</label>
          <input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} className="w-full border dark:border-slate-700 rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. 0888123456" />

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Amount paid</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border dark:border-slate-700 rounded px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" required />
          {short && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded p-2">
              ⚠️ Short payment: you entered {paid.toLocaleString()} of {due.toLocaleString()} due. Admin will see this variance.
            </p>
          )}

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Proof (screenshot/receipt)</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full text-sm" />

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">{submitting ? "Submitting…" : "Submit repayment"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
