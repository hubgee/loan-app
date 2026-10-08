import { useMemo, useState } from "react";
import { calcLoan } from "../api/loanDecisions";
import { PAYOUT_PROVIDER_LABELS } from "./LoanForm";
import { COLLATERAL_TYPES, coverageInfo, isMobileDevice, normalizeCameraFile } from "../api/collateral";

const MOBILE_PROVIDERS = [
  { id: "airtel_money", label: "Airtel Money" },
  { id: "tnm_mpamba", label: "TNM Mpamba" },
];

const BANK_PROVIDERS = [
  { id: "fdh", label: "FDH Bank" },
  { id: "national_bank", label: "National Bank of Malawi" },
  { id: "standard_bank", label: "Standard Bank" },
];

export default function LoanEditModal({ loan, existingFileCount = 0, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    borrower_name: loan.name ?? loan.borrower_name ?? "",
    phone: loan.phone ?? "",
    email: loan.email ?? "",
    amount: loan.amount ?? "",
    duration: loan.duration ?? "1_week",
    payout_method: loan.payout_method ?? "mobile_money",
    payout_provider: loan.payout_provider ?? "",
    payout_account_name: loan.payout_account_name ?? "",
    payout_account_number: loan.payout_account_number ?? "",
    payout_branch: loan.payout_branch ?? "",
    collateral_type: loan.collateral_type ?? "",
    collateral_description: loan.collateral_description ?? "",
    collateral_value: loan.collateral_value ?? "",
    newFiles: [],
    ackShortfall: false,
    reason: "",
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const { interest, totalRepayment } = calcLoan(form.amount, form.duration);
  const providers = form.payout_method === "bank" ? BANK_PROVIDERS : MOBILE_PROVIDERS;
  const coverage = useMemo(
    () => coverageInfo({ amount: form.amount, totalRepayment, collateralValue: form.collateral_value }),
    [form.amount, form.collateral_value, totalRepayment]
  );
  const totalFiles = existingFileCount + form.newFiles.length;
  const isMobile = isMobileDevice();

  const handleCameraCapture = (e) => {
    const shot = e.target.files?.[0];
    e.target.value = "";
    if (!shot) return;
    setForm((p) => {
      if (existingFileCount + p.newFiles.length >= 6) return p;
      return { ...p, newFiles: [...p.newFiles, normalizeCameraFile(shot)] };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.borrower_name.trim() || !form.amount || !form.payout_provider) {
      alert("Name, amount and payout provider are required.");
      return;
    }
    if (!form.collateral_type || !String(form.collateral_description ?? "").trim() || !form.collateral_value) {
      alert("Collateral type, description and value are required.");
      return;
    }
    if (!(Number(form.collateral_value) >= Number(form.amount))) {
      alert("Collateral must at least cover the amount received.");
      return;
    }
    if (totalFiles < 4) {
      alert(`At least 4 collateral files required (currently ${totalFiles}). Please add more.`);
      return;
    }
    if (form.newFiles.length > 6) {
      alert("Max 6 new files.");
      return;
    }
    if (coverage && coverage.shortfall > 0 && !form.ackShortfall) {
      alert("Please tick the shortfall acknowledgement.");
      return;
    }
    if (!form.reason.trim()) {
      alert("Please tell the admin what you want changed and why.");
      return;
    }
    onSubmit({ ...form, interest, totalRepayment, shortfall: coverage?.shortfall ?? 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-[60] p-0 md:p-4">
      <div className="bg-white dark:bg-slate-800 w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Request edit</h3>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 text-xl px-2" aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={form.borrower_name} onChange={(e) => set("borrower_name", e.target.value)} placeholder="Full name" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="Amount" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
            <select value={form.duration} onChange={(e) => set("duration", e.target.value)} className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
              <option value="1_week">1 Week (15%)</option>
              <option value="2_weeks">2 Weeks (30%)</option>
              <option value="1_month">1 Month (60%)</option>
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            {COLLATERAL_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => set("collateral_type", t.id)}
                className={`px-3 py-1.5 rounded-full text-sm border ${form.collateral_type === t.id ? "bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <textarea value={form.collateral_description} onChange={(e) => set("collateral_description", e.target.value)} placeholder="Collateral description" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
          <input type="number" value={form.collateral_value} onChange={(e) => set("collateral_value", e.target.value)} placeholder="Collateral value (MWK)" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
          {coverage && (
            <p className="text-xs bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded p-2 text-slate-700 dark:text-slate-300">
              {coverage.passesFloor
                ? coverage.coversTotal
                  ? `✅ Covers total. Surplus Mwk ${Number(coverage.surplus).toLocaleString()} returnable.`
                  : `⚠️ Shortfall Mwk ${Number(coverage.shortfall).toLocaleString()} still owed after forfeit.`
                : "❌ Below floor — must cover amount received."}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Add files ({totalFiles}/6, existing {existingFileCount})</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Take a photo with your camera or choose saved files (images + PDFs).</p>
            <div className="flex gap-2 flex-wrap">
              {isMobile && totalFiles < 6 && (
                <label className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-sm font-medium cursor-pointer">
                  📷 Take photo
                  <input type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="hidden" />
                </label>
              )}
              <label className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium cursor-pointer bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                📁 Choose files
                <input type="file" accept="image/*,.pdf" multiple onChange={(e) => set("newFiles", Array.from(e.target.files ?? []).slice(0, 6 - existingFileCount))} className="hidden" />
              </label>
            </div>
          </div>
          {coverage && coverage.shortfall > 0 && (
            <label className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded p-3 text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.ackShortfall} onChange={(e) => set("ackShortfall", e.target.checked)} className="mt-1" />
              <span>I still owe shortfall of Mwk {Number(coverage.shortfall).toLocaleString()} after forfeit.</span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[["mobile_money", "📱 Mobile Money"], ["bank", "🏦 Bank"]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setForm((p) => ({ ...p, payout_method: id, payout_provider: "" }))}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold border ${form.payout_method === id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {providers.map((p) => (
              <button key={p.id} type="button" onClick={() => set("payout_provider", p.id)}
                className={`px-3 py-1.5 rounded-full text-sm border ${form.payout_provider === p.id ? "bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <input value={form.payout_account_number} onChange={(e) => set("payout_account_number", e.target.value)} placeholder="Account/phone number" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
          <input value={form.payout_account_name} onChange={(e) => set("payout_account_name", e.target.value)} placeholder="Account name" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
          <textarea value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="What should admin change and why? (required)" className="w-full border dark:border-slate-700 rounded px-3 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" required />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium bg-white dark:bg-slate-900">Back</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50">
              {submitting ? "Sending…" : "Send edit request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
