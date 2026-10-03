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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loanId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("loan_events")
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setEvents(data || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  if (loading) return <p className="text-xs text-slate-400">Loading history…</p>;
  if (events.length === 0)
    return <p className="text-xs text-slate-400">No history yet — status changes will appear here.</p>;

  return (
    <ol className="space-y-2 border-l-2 border-slate-200 pl-3 mt-2">
      {events.map((e) => (
        <li key={e.id} className="text-xs text-slate-600">
          <p className="font-medium text-slate-700">
            {ACTION_LABELS[e.action] ?? e.action}
            <span className="ml-1 font-normal text-slate-400">
              {e.actor_role === "admin" ? "· admin" : "· you"}
            </span>
          </p>
          {e.from_status && e.to_status && e.from_status !== e.to_status && (
            <p className="text-slate-500">
              {e.from_status} → {e.to_status}
            </p>
          )}
          {e.message && <p className="text-slate-600 mt-0.5">“{e.message}”</p>}
          <p className="text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
