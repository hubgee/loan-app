import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoanForm from "../components/LoanForm";
import LoanTracker from "../components/LoanTracker";
import LoanEditModal from "../components/LoanEditModal";
import LoanTimeline from "../components/LoanTimeline";
import ConfirmReceiptPanel from "../components/ConfirmReceiptPanel";
import SubmitRepaymentModal from "../components/SubmitRepaymentModal";
import RepaymentCountdown from "../components/RepaymentCountdown";
import { supabase } from "../api/supabaseClient";
import { calcLoan, logLoanEvent } from "../api/loanDecisions";
import { useAuth } from "../auth/useAuth";

const ACTIVE_STATUSES = ["pending", "approved", "confirmed", "edit_requested", "disbursement_pending", "active", "repayment_pending"];

function mapRow(l) {
  return {
    id: l.id,
    name: l.borrower_name,
    borrower_name: l.borrower_name,
    email: l.email,
    phone: l.phone,
    amount: l.amount,
    duration: l.duration,
    interest_amount: l.interest_amount,
    total_repayment: l.total_repayment,
    repayment_date: l.repayment_date,
    status: l.status,
    payout_method: l.payout_method,
    payout_provider: l.payout_provider,
    payout_account_name: l.payout_account_name,
    payout_account_number: l.payout_account_number,
    payout_branch: l.payout_branch,
    collateral_type: l.collateral_type,
    collateral_description: l.collateral_description,
    collateral_value: l.collateral_value,
    collateral_shortfall: l.collateral_shortfall,
    shortfall_acknowledged: l.shortfall_acknowledged,
    borrower_message: l.borrower_message,
    borrower_decided_at: l.borrower_decided_at,
  };
}

export default function UserDashboard({ initialTab = "apply" }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab === "loans" ? "loans" : "apply");
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLoan, setActiveLoan] = useState(null);
  const [acting, setActing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showRepayment, setShowRepayment] = useState(false);
  const [editFileCount, setEditFileCount] = useState(0);

  const openEdit = async () => {
    setShowEdit(true);
    if (fullActiveLoan?.id) {
      const { count } = await supabase
        .from("loan_collateral_files")
        .select("id", { count: "exact", head: true })
        .eq("loan_id", fullActiveLoan.id);
      setEditFileCount(count ?? 0);
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setLoans((data || []).map(mapRow));

    const { data: active } = await supabase
      .from("loan_applications")
      .select("id, status, total_repayment, repayment_date, borrower_message")
      .eq("user_id", user.id)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveLoan(active);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initialTab === "loans" ? "loans" : "apply");
  }, [initialTab]);

  const handleNewLoan = () => {
    load();
    setTab("loans");
  };

  const fullActiveLoan = activeLoan ? loans.find((l) => l.id === activeLoan.id) ?? activeLoan : null;

  const handleConfirm = async () => {
    if (!fullActiveLoan || fullActiveLoan.status !== "approved") return;
    if (!window.confirm("Confirm these loan details are correct and trigger disbursement?")) return;
    setActing(true);
    try {
      const { error } = await supabase
        .from("loan_applications")
        .update({
          status: "confirmed",
          borrower_message: null,
          borrower_decided_at: new Date().toISOString(),
          admin_seen: false,
        })
        .eq("id", fullActiveLoan.id)
        .eq("status", "approved");
      if (error) throw error;
      await logLoanEvent({
        loanId: fullActiveLoan.id, actorRole: "borrower", actorId: user.id,
        action: "confirmed", fromStatus: "approved", toStatus: "confirmed",
        message: "Borrower confirmed details — ready to disburse",
      });
      await load();
    } catch (e) {
      alert(e.message || "Confirm failed");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!fullActiveLoan) return;
    if (!cancelReason.trim()) {
      alert("Please give a short reason so admin knows why.");
      return;
    }
    setActing(true);
    try {
      const { error } = await supabase
        .from("loan_applications")
        .update({
          status: "cancelled",
          borrower_message: cancelReason.trim(),
          borrower_decided_at: new Date().toISOString(),
          admin_seen: false,
        })
        .eq("id", fullActiveLoan.id)
        .eq("status", "approved");
      if (error) throw error;
      await logLoanEvent({
        loanId: fullActiveLoan.id, actorRole: "borrower", actorId: user.id,
        action: "cancelled", fromStatus: "approved", toStatus: "cancelled",
        message: cancelReason.trim(),
      });
      setShowCancel(false);
      setCancelReason("");
      await load();
    } catch (e) {
      alert(e.message || "Cancel failed");
    } finally {
      setActing(false);
    }
  };

  const handleEditSubmit = async (form) => {
    const { interest, totalRepayment } = calcLoan(form.amount, form.duration);
    const rate = form.duration === "1_week" ? 0.15 : form.duration === "2_weeks" ? 0.30 : 0.60;
    const date = new Date();
    if (form.duration === "1_week") date.setDate(date.getDate() + 7);
    else if (form.duration === "2_weeks") date.setDate(date.getDate() + 14);
    else date.setMonth(date.getMonth() + 1);
    setActing(true);
    try {
      const { error } = await supabase
        .from("loan_applications")
        .update({
          borrower_name: form.borrower_name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          amount: Number(form.amount),
          duration: form.duration,
          interest_rate: rate,
          interest_amount: interest,
          total_repayment: totalRepayment,
          repayment_date: date.toISOString().split("T")[0],
          payout_method: form.payout_method,
          payout_provider: form.payout_provider,
          payout_account_name: form.payout_account_name.trim(),
          payout_account_number: form.payout_account_number.trim(),
          payout_branch: form.payout_method === "bank" ? form.payout_branch.trim() : null,
          collateral_type: form.collateral_type,
          collateral_description: String(form.collateral_description ?? "").trim(),
          collateral_value: Number(form.collateral_value),
          collateral_shortfall: form.shortfall ?? 0,
          shortfall_acknowledged: (form.shortfall ?? 0) > 0,
          status: "edit_requested",
          borrower_message: form.reason.trim(),
          borrower_decided_at: new Date().toISOString(),
          admin_seen: false,
        })
        .eq("id", fullActiveLoan.id)
        .eq("status", "approved");
      if (error) throw error;
      for (const f of form.newFiles ?? []) {
        const cPath = `${user.id}/collateral/${Date.now()}_${f.name}`;
        const { error: cErr } = await supabase.storage.from("proofs").upload(cPath, f, { upsert: false });
        if (cErr) throw cErr;
        const { error: rowErr } = await supabase.from("loan_collateral_files").insert({
          loan_id: fullActiveLoan.id,
          storage_path: cPath,
          original_name: f.name,
          mime_type: f.type || null,
        });
        if (rowErr) throw rowErr;
      }
      await logLoanEvent({
        loanId: fullActiveLoan.id, actorRole: "borrower", actorId: user.id,
        action: "edit_requested", fromStatus: "approved", toStatus: "edit_requested",
        message: form.reason.trim(),
      });
      setShowEdit(false);
      await load();
    } catch (e) {
      alert(e.message || "Edit request failed");
    } finally {
      setActing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const bannerFor = (loan) => {
    if (!loan) return null;
    if (loan.status === "pending")
      return { title: "Loan Pending Approval", body: "Your application is under review. Once approved you will confirm, edit or cancel it here.", icon: "⏳" };
    if (loan.status === "approved")
      return { title: "Approved — action needed", body: "Admin approved your loan. Please confirm the details are correct to trigger disbursement, or request an edit / cancel.", icon: "✅" };
    if (loan.status === "confirmed")
      return { title: "Confirmed — awaiting disbursement", body: "You confirmed. Admin will now send the money and record the reference so you can verify receipt.", icon: "💸" };
    if (loan.status === "disbursement_pending")
      return { title: "Disbursement sent — confirm receipt", body: "Admin marked funds as sent. Please check and confirm below.", icon: "📲" };
    if (loan.status === "active")
      return { title: "Active Loan", body: "Send repayment externally, then submit the reference number here.", icon: "📋" };
    if (loan.status === "repayment_pending")
      return { title: "Repayment submitted", body: "Admin is verifying your repayment reference.", icon: "🔍" };
    if (loan.status === "edit_requested")
      return { title: "Edit sent — waiting for admin", body: "Admin is reviewing your requested changes. You will confirm again once re-approved.", icon: "✏️" };
    return { title: "Active Loan", body: "Repay on time to unlock higher limits.", icon: "📋" };
  };
  const banner = bannerFor(activeLoan);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">My Loans</h1>

        {activeLoan && banner && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  {banner.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-900">{banner.title}</h3>
                  <p className="text-amber-800 mt-1">{banner.body}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
                <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium">
                  {activeLoan.status === "pending" ? "Pending Approval" : activeLoan.status.replace("_", " ")}
                </span>
                {activeLoan.total_repayment && (
                  <span className="text-amber-800 font-medium">
                    Total due: Mkw {Number(activeLoan.total_repayment).toLocaleString()}
                  </span>
                )}
                {activeLoan.repayment_date && (
                  <span className="text-amber-800">Due: {formatDate(activeLoan.repayment_date)}</span>
                )}
              </div>
            </div>

            {activeLoan && (
              <RepaymentCountdown loan={activeLoan} />
            )}

            {activeLoan.status === "disbursement_pending" && fullActiveLoan && (
              <ConfirmReceiptPanel loan={fullActiveLoan} onDone={load} />
            )}

            {activeLoan.status === "active" && fullActiveLoan && (
              <button
                onClick={() => setShowRepayment(true)}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold"
              >
                Submit Repayment
              </button>
            )}

            {activeLoan.status === "approved" && fullActiveLoan && (
              <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-sm font-medium text-slate-800">Review your approved loan:</p>
                {!showCancel ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button disabled={acting} onClick={handleConfirm} className="py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50">
                      {acting ? "Working…" : "✓ Confirm loan"}
                    </button>
                    <button disabled={acting} onClick={openEdit} className="py-3 rounded-xl bg-white border border-slate-300 font-semibold text-slate-700">
                      ✏️ Edit loan
                    </button>
                    <button disabled={acting} onClick={() => setShowCancel(true)} className="py-3 rounded-xl bg-white border border-red-300 font-semibold text-red-700">
                      ✕ Cancel loan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancelling (required)" className="w-full border rounded px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowCancel(false)} className="flex-1 py-2 rounded-xl border border-slate-300 text-sm">Back</button>
                      <button disabled={acting} onClick={handleCancel} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
                        {acting ? "Cancelling…" : "Confirm cancel"}
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500">Confirm triggers disbursement. Edit lets you change amount, duration, payout and contact details.</p>
              </div>
            )}
          </div>
        )}

        <div className="hidden md:flex gap-2">
          {[{ key: "apply", label: "Apply" }, { key: "loans", label: "My Loans" }].map((t) => {
            const disabled = t.key === "apply" && activeLoan;
            return (
              <button
                key={t.key}
                onClick={() => { if (disabled) return; setTab(t.key); }}
                disabled={disabled}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  tab === t.key ? "bg-indigo-600 text-white"
                  : disabled ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "apply" ? (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            {activeLoan ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {activeLoan.status === "pending" ? "Loan Pending Approval" : `Loan ${activeLoan.status.replace("_", " ")}`}
                </h3>
                <p className="text-slate-600 mb-4 max-w-md mx-auto">
                  {activeLoan.status === "approved"
                    ? "Your loan was approved — use the panel above to confirm, edit or cancel."
                    : "You have an active loan. Finish it before applying again."}
                </p>
                {fullActiveLoan?.id && (
                  <div className="text-left max-w-md mx-auto">
                    <LoanTimeline loanId={fullActiveLoan.id} />
                  </div>
                )}
              </div>
            ) : (
              <LoanForm onAddLoan={handleNewLoan} />
            )}
          </div>
        ) : loading ? (
          <p className="text-slate-500">Loading your loans...</p>
        ) : (
          <LoanTracker loans={loans} editable={false} showTimeline />
        )}

        <p className="text-sm text-slate-500">
          Need help? <Link to="/Terms-Conditions.pdf" className="text-indigo-600 underline">Terms &amp; Conditions</Link>
        </p>
      </div>

      {showEdit && fullActiveLoan && (
        <LoanEditModal loan={fullActiveLoan} existingFileCount={editFileCount} onClose={() => setShowEdit(false)} onSubmit={handleEditSubmit} submitting={acting} />
      )}

      {showRepayment && fullActiveLoan && (
        <SubmitRepaymentModal loan={fullActiveLoan} onClose={() => setShowRepayment(false)} onDone={load} />
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 z-50">
        <button onClick={() => { if (activeLoan) return; setTab("apply"); }} disabled={activeLoan}
          className={`px-4 py-2 text-sm font-medium ${tab === "apply" ? "text-indigo-600" : activeLoan ? "text-slate-400" : "text-slate-500"}`}>
          📝 Apply
        </button>
        <button onClick={() => setTab("loans")} className={`px-4 py-2 text-sm font-medium ${tab === "loans" ? "text-indigo-600" : "text-slate-500"}`}>
          📄 My Loans
        </button>
      </nav>
    </div>
  );
}
