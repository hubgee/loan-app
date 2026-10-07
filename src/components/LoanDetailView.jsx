import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import CollateralGallery from "./CollateralGallery";
import LoanTimeline from "./LoanTimeline";
import { COLLATERAL_LABELS } from "../api/collateral";

const STATUS_PILL = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  confirmed: "bg-blue-100 text-blue-800",
  disbursement_pending: "bg-purple-100 text-purple-800",
  active: "bg-indigo-100 text-indigo-800",
  repayment_pending: "bg-yellow-100 text-yellow-800",
  forfeiture_pending: "bg-orange-100 text-orange-800",
  edit_requested: "bg-orange-100 text-orange-800",
  cancelled: "bg-slate-200 text-slate-700",
  repaid: "bg-indigo-100 text-indigo-800",
  forfeited: "bg-slate-800 text-white",
};

const STATUS_PROGRESS = {
  pending: "20%",
  approved: "50%",
  edit_requested: "60%",
  confirmed: "65%",
  disbursement_pending: "75%",
  active: "85%",
  repayment_pending: "92%",
  forfeiture_pending: "92%",
  cancelled: "100%",
  repaid: "100%",
  forfeited: "100%",
};

const DURATION_LABELS = { "1_week": "1 Week", "2_weeks": "2 Weeks", "1_month": "1 Month" };

const PAYOUT_PROVIDER_LABELS = {
  airtel_money: "Airtel Money",
  tnm_mpamba: "TNM Mpamba",
  fdh: "FDH Bank",
  national_bank: "National Bank of Malawi",
  standard_bank: "Standard Bank",
};

function formatDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LoanDetailView({ loan, index, total, onClose, onPrev, onNext, onAdminAction, acting }) {
  const [tab, setTab] = useState("overview");
  const [idUrl, setIdUrl] = useState(null);
  const [idLoading, setIdLoading] = useState(false);
  const [idError, setIdError] = useState("");
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => { setTab("overview"); }, [loan?.id]);

  useEffect(() => {
    if (!loan?.national_id_path) {
      setIdUrl(null);
      return;
    }
    setIdLoading(true);
    setIdError("");
    const load = async () => {
      const { data, error } = await supabase.storage.from("ids").createSignedUrl(loan.national_id_path, 3600);
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

  const principal = Number(loan.amount || 0);
  const totalDue = Number(loan.total_repayment || 0);
  const colVal = Number(loan.collateral_value || 0);
  const shortfall = Number(loan.collateral_shortfall ?? Math.max(0, totalDue - colVal));
  const surplus = Math.max(0, colVal - totalDue);
  const coversTotal = totalDue > 0 && colVal >= totalDue;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-start md:items-center justify-center p-0 md:p-4 overflow-y-auto">
      <div className="bg-white w-full md:max-w-5xl md:p-6 p-4 md:rounded-2xl rounded-t-2xl space-y-4 mt-8 md:mt-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500">Loan {index + 1} of {total}</p>
            <h3 className="text-xl font-bold text-slate-900">{loan.name} — {loan.id}</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 text-xl px-2" aria-label="Close">✕</button>
        </div>

        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_PILL[loan.status] ?? "bg-slate-200 text-slate-700"}`}>
            {loan.status.replace("_", " ").toUpperCase()}
          </span>
          {loan.admin_seen === false && <span className="text-xs text-red-600 font-semibold">● Needs review</span>}
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: STATUS_PROGRESS[loan.status] ?? "25%" }} />
        </div>

        <div className="flex gap-2 overflow-x-auto text-sm">
          {[["overview", "Overview"], ["collateral", "Collateral"], ["documents", "National ID"], ["history", "History"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-full border whitespace-nowrap ${tab === id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Borrower</h4>
                <p className="text-sm">Name: <span className="font-medium">{loan.name}</span></p>
                <p className="text-sm">Email: {loan.email || "—"}</p>
                <p className="text-sm">Phone: {loan.phone || "—"}</p>
              </section>
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Loan</h4>
                <p className="text-sm">Amount: Mwk {principal.toLocaleString()}</p>
                <p className="text-sm">Duration: {DURATION_LABELS[loan.duration] ?? loan.duration}</p>
                <p className="text-sm">Interest: Mwk {Number(loan.interest_amount).toLocaleString()}</p>
                <p className="text-sm">Total repayment: Mwk {totalDue.toLocaleString()}</p>
                <p className="text-sm">Due date: {formatDate(loan.repayment_date)}</p>
              </section>
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Payout details</h4>
                <p className="text-sm">Provider: {PAYOUT_PROVIDER_LABELS[loan.payout_provider] ?? "—"}</p>
                <p className="text-sm">Account: {loan.payout_account_number} ({loan.payout_account_name})</p>
              </section>
              {loan.borrower_message && (
                <section className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="text-sm text-orange-900">“{loan.borrower_message}”</p>
                </section>
              )}
              {(loan.status === "repaid" || loan.status === "forfeited") && (
                <section className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Settlement</h4>
                  <p>
                    Method:{" "}
                    {loan.status === "repaid" ? "Cash repayment" : "Collateral forfeiture"}
                  </p>
                  {loan.settled_at && (
                    <p>Settled: {formatDate(loan.settled_at)}</p>
                  )}
                  {loan.status === "forfeited" &&
                    Number(loan.shortfall_outstanding || 0) > 0 && (
                      <p className="text-amber-700">
                        Shortfall Mwk {Number(loan.shortfall_outstanding).toLocaleString()} still
                        owed.
                      </p>
                    )}
                </section>
              )}
            </div>
            <div className="space-y-4">
              <section className={`border rounded-xl p-3 text-sm ${coversTotal ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <h4 className="text-xs font-bold uppercase tracking-wide">Collateral coverage</h4>
                <p>{COLLATERAL_LABELS[loan.collateral_type] ?? "—"} • Mwk {colVal.toLocaleString()}</p>
                {coversTotal ? (
                  <p className="text-green-800">✅ Covers total. Surplus Mwk {surplus.toLocaleString()} returnable.</p>
                ) : (
                  <p className="text-amber-800">⚠️ Shortfall Mwk {shortfall.toLocaleString()} still owed after forfeit. {loan.shortfall_acknowledged ? "Borrower acknowledged." : "Not acknowledged."}</p>
                )}
              </section>
              <section className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {loan.status === "pending" && (
                    <button disabled={acting === loan.id} onClick={() => onAdminAction("approve", loan)} className="px-4 py-2 rounded-full text-sm bg-green-600 text-white disabled:opacity-50">Approve</button>
                  )}
                  {loan.status === "edit_requested" && (
                    <button disabled={acting === loan.id} onClick={() => onAdminAction("reapprove", loan)} className="px-4 py-2 rounded-full text-sm bg-green-600 text-white disabled:opacity-50">Accept edits → re-approve</button>
                  )}
                  {loan.status === "confirmed" && (
                    <button disabled={acting === loan.id} onClick={() => onAdminAction("disburse", loan)} className="px-4 py-2 rounded-full text-sm bg-blue-600 text-white disabled:opacity-50">Disburse funds</button>
                  )}
                  {loan.status === "repayment_pending" && (
                    <button disabled={acting === loan.id} onClick={() => onAdminAction("verify_repayment", loan)} className="px-4 py-2 rounded-full text-sm bg-indigo-600 text-white disabled:opacity-50">Verify repayment</button>
                  )}
                  {loan.status === "forfeiture_pending" && (
                    <button disabled={acting === loan.id} onClick={() => onAdminAction("review_forfeiture", loan)} className="px-4 py-2 rounded-full text-sm bg-orange-600 text-white disabled:opacity-50">Review forfeiture</button>
                  )}
                  {loan.admin_seen === false && (
                    <button disabled={acting === loan.id} onClick={() => onAdminAction("acknowledge", loan)} className="px-4 py-2 rounded-full text-sm bg-white border border-slate-300 disabled:opacity-50">Mark reviewed</button>
                  )}
                </div>
              </section>
              <button onClick={() => setTab("collateral")} className="text-sm text-indigo-600 underline">View collateral photos →</button>
            </div>
          </div>
        )}

        {tab === "collateral" && (
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Type:</span> {COLLATERAL_LABELS[loan.collateral_type] ?? "—"}</p>
              <p><span className="font-medium">Description:</span> {loan.collateral_description || "—"}</p>
              <p><span className="font-medium">Value:</span> Mwk {colVal.toLocaleString()} (principal Mwk {principal.toLocaleString()}, total Mwk {totalDue.toLocaleString()})</p>
              {coversTotal
                ? <p className="text-green-700">Surplus Mwk {surplus.toLocaleString()} returnable on forfeit.</p>
                : <p className="text-amber-700">Shortfall Mwk {shortfall.toLocaleString()} still owed after forfeit.</p>}
            </div>
            <CollateralGallery loanId={loan.id} />
          </div>
        )}

        {tab === "documents" && (
          <section className="space-y-2">
            {idLoading && <p className="text-sm text-slate-500">Loading document…</p>}
            {idError && <p className="text-sm text-red-600">{idError}</p>}
            {idUrl && (
              <div className="border rounded-xl overflow-hidden bg-slate-50">
                {isPdf ? <iframe src={idUrl} title="National ID" className="w-full h-80 md:h-[28rem]" /> : <img src={idUrl} alt="National ID" className="w-full object-contain max-h-[28rem]" />}
              </div>
            )}
            {idUrl && <a href={idUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 underline">Open in new tab</a>}
            {!loan.national_id_path && <p className="text-sm text-slate-500">No ID document uploaded.</p>}
          </section>
        )}

        {tab === "history" && <LoanTimeline loanId={loan.id} />}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button disabled={index === 0} onClick={() => onPrev()} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">← Prev</button>
          <span className="text-xs text-slate-500">{index + 1} / {total}</span>
          <button disabled={index === total - 1} onClick={() => onNext()} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Next →</button>
        </div>
      </div>
    </div>
  );
}
