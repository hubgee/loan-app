import { useEffect, useState } from "react";
import { createTransaction } from "../api/paymentTracking";
import { supabase } from "../api/supabaseClient";
import { logLoanEvent } from "../api/loanDecisions";

const PROVIDER_OPTIONS = [
  { value: "airtel_money", label: "Airtel Money" },
  { value: "tnm_mpamba", label: "TNM Mpamba" },
  { value: "fdh", label: "FDH Bank" },
  { value: "national_bank", label: "National Bank of Malawi" },
  { value: "standard_bank", label: "Standard Bank" },
];

export default function DisburseModal({ loan, onClose, onDone }) {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(loan?.payout_provider || "airtel_money");
  const [amount, setAmount] = useState(loan?.amount ?? "");
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { data: userData } = { data: { user: null } };

  useEffect(() => {
    setPaymentMethod(loan?.payout_provider || "airtel_money");
    setAmount(loan?.amount ?? "");
  }, [loan?.id]);

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
        type: "disbursement",
        referenceNumber: referenceNumber.trim(),
        paymentMethod,
        amount: Number(amount),
        proofFile,
        submittedBy: user.id,
      });
      await supabase
        .from("loan_applications")
        .update({ status: "disbursement_pending", admin_seen: false })
        .eq("id", loan.id);
      await logLoanEvent({
        loanId: loan.id,
        actorRole: "admin",
        actorId: user.id,
        action: "disbursement_submitted",
        fromStatus: "confirmed",
        toStatus: "disbursement_pending",
        message: `Admin sent ${Number(amount).toLocaleString()} via ${paymentMethod}. Ref: ${referenceNumber}`,
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
        <h3 className="text-lg font-bold text-slate-800">Disburse Funds</h3>
        <p className="text-sm text-slate-600">Enter the reference number from your mobile money / bank so the borrower can confirm receipt.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-medium text-slate-600">Reference / Transaction ID</label>
          <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. TXN123456" required />

          <label className="block text-xs font-medium text-slate-600">Channel used</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-slate-600">Amount sent</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />

          <label className="block text-xs font-medium text-slate-600">Proof (screenshot/receipt)</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full text-sm" />

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-300 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50">{submitting ? "Saving…" : "Mark disbursed"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
