import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";

const ACTION_LABELS = {
  submitted: "Application submitted",
  approved: "Approved by admin",
  confirmed: "Confirmed by borrower — ready to disburse",
  edit_requested: "Edit requested by borrower",
  cancelled: "Cancelled by borrower",
  re_approved: "Re-approved by admin",
  acknowledged: "Reviewed by admin",
  repaid: "Marked repaid",
};

export default function LoanTimeline({ loanId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loanId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: events }, { data: txs }] = await Promise.all([
        supabase.from("loan_events").select("*").eq("loan_id", loanId).order("created_at", { ascending: true }),
        supabase.from("loan_transactions").select("*").eq("loan_id", loanId).order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      const eventItems = (events || []).map((e) => ({ kind: "event", data: e, at: e.created_at }));
      const txItems = (txs || []).map((t) => ({ kind: "transaction", data: t, at: t.created_at }));
      const merged = [...eventItems, ...txItems].sort((a, b) => new Date(a.at) - new Date(b.at));
      setItems(merged);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [loanId]);

  if (loading) return <p className="text-xs text-slate-400">Loading history…</p>;
  if (items.length === 0)
    return <p className="text-xs text-slate-400">No history yet — status changes will appear here.</p>;

  return (
    <ol className="space-y-2 border-l-2 border-slate-200 pl-3 mt-2">
      {items.map((item, idx) => {
        if (item.kind === "event") {
          const e = item.data;
          return (
            <li key={`e-${e.id ?? idx}`} className="text-xs text-slate-600">
              <p className="font-medium text-slate-700">
                {ACTION_LABELS[e.action] ?? e.action}
                <span className="ml-1 font-normal text-slate-400">
                  {e.actor_role === "admin" ? "· admin" : "· you"}
                </span>
              </p>
              {e.from_status && e.to_status && e.from_status !== e.to_status && (
                <p className="text-slate-500">{e.from_status} → {e.to_status}</p>
              )}
              {e.message && <p className="text-slate-600 mt-0.5">“{e.message}”</p>}
              <p className="text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
            </li>
          );
        }
        const t = item.data;
        return (
          <li key={`t-${t.id ?? idx}`} className="text-xs text-slate-600">
            <p className="font-medium text-slate-700">
              {t.type === "disbursement" ? "💸 Disbursement submitted" : "💰 Repayment submitted"}
              <span className="ml-1 font-normal text-slate-400">· {t.status}</span>
            </p>
            <p className="text-slate-500">Channel: {t.payment_method} · Amount: {t.amount ? `Mkw ${Number(t.amount).toLocaleString()}` : "—"}</p>
            <p className="text-slate-500">Ref: <span className="font-mono">{t.reference_number}</span></p>
            {t.proof_url && <ProofLink path={t.proof_url} />}
            <p className="text-slate-400">{new Date(t.created_at).toLocaleString()}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ProofLink({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.storage.from("proofs").createSignedUrl(path, 3600);
      if (data?.signedUrl) setUrl(data.signedUrl);
    };
    load();
  }, [path]);
  if (!url) return <p className="text-slate-400">Loading proof…</p>;
  return <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">View proof</a>;
}

