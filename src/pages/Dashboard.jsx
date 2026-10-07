// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LoanTracker from "../components/LoanTracker";
import LoanDetailView from "../components/LoanDetailView";
import DisburseModal from "../components/DisburseModal";
import VerifyRepaymentModal from "../components/VerifyRepaymentModal";
import ForfeitureReviewModal from "../components/ForfeitureReviewModal";
import { supabase } from "../api/supabaseClient";
import { logLoanEvent } from "../api/loanDecisions";
import { useAuth } from "../auth/useAuth";

const PAGE_SIZE = 3;

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [detailIndex, setDetailIndex] = useState(null);
  const [disburseLoan, setDisburseLoan] = useState(null);
  const [verifyLoan, setVerifyLoan] = useState(null);
  const [forfeitLoan, setForfeitLoan] = useState(null);

  // Filtering + pagination controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const applications = (data || []).map((l) => ({
        id: l.id,
        name: l.borrower_name,
        email: l.email,
        phone: l.phone,
        amount: l.amount,
        duration: l.duration,
        interest_amount: l.interest_amount,
        total_repayment: l.total_repayment,
        repayment_date: l.repayment_date,
        purpose: l.purpose,
        status: l.status,
        payout_method: l.payout_method,
        payout_provider: l.payout_provider,
        payout_account_name: l.payout_account_name,
        payout_account_number: l.payout_account_number,
        payout_branch: l.payout_branch,
        borrower_message: l.borrower_message,
        borrower_decided_at: l.borrower_decided_at,
        admin_seen: l.admin_seen,
        settlement_method: l.settlement_method,
        settled_at: l.settled_at,
        forfeiture_reason: l.forfeiture_reason,
        forfeiture_requested_at: l.forfeiture_requested_at,
        shortfall_outstanding: l.shortfall_outstanding,
        collateral_type: l.collateral_type,
        collateral_description: l.collateral_description,
        collateral_value: l.collateral_value,
        collateral_shortfall: l.collateral_shortfall,
        shortfall_acknowledged: l.shortfall_acknowledged,
        national_id_path: l.national_id_path,
        national_id_original: l.national_id_original,
        created_at: l.created_at,
      }));

      setLoans(applications);
      setStats({
        total: applications.length,
        pending: applications.filter((l) => l.status === "pending").length,
        approved: applications.filter((l) => l.status === "approved").length,
        confirmed: applications.filter((l) => l.status === "confirmed").length,
        disbursement_pending: applications.filter((l) => l.status === "disbursement_pending").length,
        active: applications.filter((l) => l.status === "active").length,
        repayment_pending: applications.filter((l) => l.status === "repayment_pending").length,
        forfeiture_pending: applications.filter((l) => l.status === "forfeiture_pending").length,
        edit_requested: applications.filter((l) => l.status === "edit_requested").length,
        needsAttention: applications.filter((l) => l.admin_seen === false).length,
        repaid: applications.filter((l) => l.status === "repaid").length,
        forfeited: applications.filter((l) => l.status === "forfeited").length,
      });
    } catch (err) {
      console.error("Failed to load loans", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  // Filter + search + payout method + needs-review + sort
  const filteredLoans = useMemo(() => {
    let out = [...loans];
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q) ||
          String(l.amount).includes(q)
      );
    }
    if (statusFilter !== "all") out = out.filter((l) => l.status === statusFilter);
    if (payoutFilter !== "all") out = out.filter((l) => l.payout_method === payoutFilter);
    if (needsReviewOnly) out = out.filter((l) => l.admin_seen === false);

    if (sort === "newest") out.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    else if (sort === "oldest") out.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    else if (sort === "amount_high") out.sort((a, b) => Number(b.amount) - Number(a.amount));
    else if (sort === "amount_low") out.sort((a, b) => Number(a.amount) - Number(b.amount));
    return out;
  }, [loans, search, statusFilter, payoutFilter, needsReviewOnly, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
  const pageLoans = filteredLoans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Keep page valid when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, payoutFilter, needsReviewOnly, sort]);

  const updateLoan = async (id, updatedLoan) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdmin) throw new Error("Not authorized.");

    const prev = loans.find((l) => l.id === id);
    const { error } = await supabase
      .from("loan_applications")
      .update({ status: updatedLoan.status, processed_by: user.id, admin_seen: true })
      .eq("id", id);
    if (error) throw error;
    await logLoanEvent({
      loanId: id, actorRole: "admin", actorId: user.id,
      action: updatedLoan.status, fromStatus: prev?.status, toStatus: updatedLoan.status,
    });
    setLoans((prevList) =>
      prevList.map((l) => (l.id === id ? { ...l, status: updatedLoan.status, admin_seen: true } : l))
    );
    load();
  };

  const handleAdminAction = async (action, loan) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdmin) return;
    setActing(loan.id);
    try {
      let patch = { processed_by: user.id, admin_seen: true };
      let toStatus = loan.status;
      let eventAction = "acknowledged";
      if (action === "approve") {
        toStatus = "approved"; eventAction = "approved";
        patch = { ...patch, status: "approved" };
      } else if (action === "reapprove") {
        toStatus = "approved"; eventAction = "re_approved";
        patch = { ...patch, status: "approved", borrower_message: null };
      } else if (action === "disburse") {
        // Open modal instead of immediate status change
        setDisburseLoan(loan);
        setActing(null);
        return;
      } else if (action === "verify_repayment") {
        setVerifyLoan(loan);
        setActing(null);
        return;
      } else if (action === "review_forfeiture") {
        setForfeitLoan(loan);
        setActing(null);
        return;
      } else if (action === "repaid") {
        toStatus = "repaid"; eventAction = "repaid";
        patch = { ...patch, status: "repaid", settlement_method: "cash", settled_at: new Date().toISOString(), settled_by: user.id };
      } else if (action === "acknowledge") {
        patch = { ...patch, admin_seen: true };
      }
      const { error } = await supabase.from("loan_applications").update(patch).eq("id", loan.id);
      if (error) throw error;
      await logLoanEvent({
        loanId: loan.id, actorRole: "admin", actorId: user.id,
        action: eventAction, fromStatus: loan.status, toStatus,
      });
      await load();
    } catch (e) {
      alert(e.message || "Action failed");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <Link
          to="/admin/users"
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 w-fit"
        >
          Manage users
        </Link>
      </div>

      {stats.needsAttention > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          🔔 {stats.needsAttention} loan{stats.needsAttention > 1 ? "s need" : " needs"} review
          {[
            stats.pending > 0 && `${stats.pending} new`,
            stats.edit_requested > 0 && `${stats.edit_requested} edit request${stats.edit_requested > 1 ? "s" : ""}`,
            stats.confirmed > 0 && `${stats.confirmed} confirmed — ready to disburse`,
            stats.disbursement_pending > 0 && `${stats.disbursement_pending} disbursement issue${stats.disbursement_pending > 1 ? "s" : ""}`,
            stats.active > 0 && `${stats.active} active — receipt confirmed`,
            stats.repayment_pending > 0 && `${stats.repayment_pending} repayment${stats.repayment_pending > 1 ? "s" : ""} to verify`,
            stats.forfeiture_pending > 0 && `${stats.forfeiture_pending} forfeiture${stats.forfeiture_pending > 1 ? "s" : ""} to review`,
          ]
            .filter(Boolean)
            .join(" • ")}
          .
        </div>
      )}

      {/* Filter / search / sort bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone or amount…"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full md:w-auto"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount_high">Amount: high → low</option>
            <option value="amount_low">Amount: low → high</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {["all", "pending", "approved", "confirmed", "disbursement_pending", "active", "repayment_pending", "forfeiture_pending", "edit_requested", "cancelled", "repaid", "forfeited"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full border ${
                statusFilter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={payoutFilter}
            onChange={(e) => setPayoutFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5"
          >
            <option value="all">All payouts</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank">Bank</option>
          </select>
          <button
            onClick={() => setNeedsReviewOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-full border ${
              needsReviewOnly ? "bg-red-100 border-red-300 text-red-700" : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            {needsReviewOnly ? "● Needs review only" : "Needs review only"}
          </button>
          <p className="ml-auto text-slate-500">
            Showing {pageLoans.length} of {filteredLoans.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-gray-600">Total Loans</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.pending}</p>
          <p className="text-gray-600">Pending</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.approved}</p>
          <p className="text-gray-600">Approved</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.confirmed}</p>
          <p className="text-gray-600">Confirmed</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.edit_requested}</p>
          <p className="text-gray-600">Edit requests</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <p className="text-lg font-bold">{stats.repaid}</p>
          <p className="text-gray-600">Repaid</p>
        </div>
      </div>

      <LoanTracker
        loans={pageLoans}
        onUpdateLoan={updateLoan}
        onAdminAction={handleAdminAction}
        showTimeline
        onViewDetail={(id) => {
          const i = filteredLoans.findIndex((l) => l.id === id);
          if (i >= 0) setDetailIndex(i);
        }}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium disabled:opacity-40"
        >
          ← Prev
        </button>
        <p className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </p>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      {acting && <p className="text-xs text-slate-500">Updating…</p>}

      {disburseLoan && (
        <DisburseModal loan={disburseLoan} onClose={() => setDisburseLoan(null)} onDone={load} />
      )}

      {verifyLoan && (
        <VerifyRepaymentModal loan={verifyLoan} onClose={() => setVerifyLoan(null)} onDone={load} />
      )}

      {forfeitLoan && (
        <ForfeitureReviewModal loan={forfeitLoan} onClose={() => setForfeitLoan(null)} onDone={load} />
      )}

      {detailIndex !== null && filteredLoans[detailIndex] && (
        <LoanDetailView
          loan={filteredLoans[detailIndex]}
          index={detailIndex}
          total={filteredLoans.length}
          onClose={() => setDetailIndex(null)}
          onPrev={() => setDetailIndex((i) => Math.max(0, i - 1))}
          onNext={() => setDetailIndex((i) => Math.min(filteredLoans.length - 1, i + 1))}
          onAdminAction={async (action, loan) => {
            await handleAdminAction(action, loan);
          }}
          acting={acting}
        />
      )}
    </div>
  );
}
