import { useState } from "react";
import { calcLoan } from "../api/loanDecisions";
import { PAYOUT_PROVIDER_LABELS } from "./LoanForm";

const MOBILE_PROVIDERS = [
  { id: "airtel_money", label: "Airtel Money" },
  { id: "tnm_mpamba", label: "TNM Mpamba" },
];

const BANK_PROVIDERS = [
  { id: "fdh", label: "FDH Bank" },
  { id: "national_bank", label: "National Bank of Malawi" },
  { id: "standard_bank", label: "Standard Bank" },
];

export default function LoanEditModal({ loan, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    borrower_name: loan.name ?? loan.borrower_name ?? "",
    phone: loan.phone ?? "",
    email: loan.email ?? "",
    amount: loan.amount ?? "",
    duration: loan.duration ?? "1_week",
    purpose: loan.purpose ?? "",
    payout_method: loan.payout_method ?? "mobile_money",
    payout_provider: loan.payout_provider ?? "",
    payout_account_name: loan.payout_account_name ?? "",
    payout_account_number: loan.payout_account_number ?? "",
    payout_branch: loan.payout_branch ?? "",
    reason: "",
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const { interest, totalRepayment } = calcLoan(form.amount, form.duration);
  const providers = form.payout_method === "bank" ? BANK_PROVIDERS : MOBILE_PROVIDERS;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.borrower_name.trim() || !form.amount || !form.payout_provider) {
      alert("Name, amount and payout provider are required.");
      return;
    }
    if (!form.payout_account_name.trim() || !form.payout_account_number.trim()) {
      alert("Payout account name and number are required.");
      return;
    }
    if (form.payout_method === "bank" && !form.payout_branch.trim()) {
      alert("Branch is required for bank payout.");
      return;
    }
    if (!form.reason.trim()) {
      alert("Please tell the admin what you want changed and why.");
      return;
    }
    onSubmit({ ...form, interest, totalRepayment });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Request edit</h3>
          <button onClick={onClose} className="text-slate-500 text-xl px-2" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Change any field. Admin will review and send it back for confirmation. Current provider:{" "}
          {PAYOUT_PROVIDER_LABELS[loan.payout_provider] ?? loan.payout_provider ?? "—"}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={form.borrower_name} onChange={(e) => set("borrower_name", e.target.value)} placeholder="Full name" className="w-full border rounded px-3 py-2" required />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className="w-full border rounded px-3 py-2" />
            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="Amount" className="w-full border rounded px-3 py-2" required />
            <select value={form.duration} onChange={(e) => set("duration", e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="1_week">1 Week (15%)</option>
              <option value="2_weeks">2 Weeks (30%)</option>
              <option value="1_month">1 Month (60%)</option>
            </select>
          </div>
          {form.amount && (
            <p className="text-xs text-slate-600 bg-yellow-50 border border-yellow-200 rounded p-2">
              New interest: Mwk {Number(interest).toLocaleString()} • Total: Mwk {Number(totalRepayment).toLocaleString()}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[["mobile_money", "📱 Mobile Money"], ["bank", "🏦 Bank"]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setForm((p) => ({ ...p, payout_method: id, payout_provider: "" }))}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold border ${form.payout_method === id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-300"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {providers.map((p) => (
              <button key={p.id} type="button" onClick={() => set("payout_provider", p.id)}
                className={`px-3 py-1.5 rounded-full text-sm border ${form.payout_provider === p.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <input value={form.payout_account_number} onChange={(e) => set("payout_account_number", e.target.value)} placeholder={form.payout_method === "bank" ? "Account number" : "Phone number"} className="w-full border rounded px-3 py-2" required />
          <input value={form.payout_account_name} onChange={(e) => set("payout_account_name", e.target.value)} placeholder={form.payout_method === "bank" ? "Account name" : "Registered name"} className="w-full border rounded px-3 py-2" required />
          {form.payout_method === "bank" && (
            <input value={form.payout_branch} onChange={(e) => set("payout_branch", e.target.value)} placeholder="Branch" className="w-full border rounded px-3 py-2" required />
          )}
          <textarea value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Purpose" className="w-full border rounded px-3 py-2" />
          <textarea value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="What should admin change and why? (required)" className="w-full border rounded px-3 py-2" required />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium">
              Back
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50">
              {submitting ? "Sending…" : "Send edit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
