// src/components/LoanForm.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../auth/useAuth";

const DURATION_RATES = {
  "1_week": 0.15,
  "2_weeks": 0.30,
  "1_month": 0.60,
};

const DURATION_DAYS = {
  "1_week": 7,
  "2_weeks": 14,
  "1_month": 0,
};

const MOBILE_PROVIDERS = [
  { id: "airtel_money", label: "Airtel Money" },
  { id: "tnm_mpamba", label: "TNM Mpamba" },
];

const BANK_PROVIDERS = [
  { id: "fdh", label: "FDH Bank" },
  { id: "national_bank", label: "National Bank of Malawi" },
  { id: "standard_bank", label: "Standard Bank" },
];

export const PAYOUT_PROVIDER_LABELS = {
  airtel_money: "Airtel Money",
  tnm_mpamba: "TNM Mpamba",
  fdh: "FDH Bank",
  national_bank: "National Bank of Malawi",
  standard_bank: "Standard Bank",
};

function payoutSummary(p) {
  if (!p?.payout_method) return "";
  const provider = PAYOUT_PROVIDER_LABELS[p.payout_provider] ?? p.payout_provider;
  if (p.payout_method === "mobile_money") {
    return `${provider} • ${p.payout_account_number ?? ""} (${p.payout_account_name ?? ""})`;
  }
  return `${provider} • Acct ${p.payout_account_number ?? ""} (${p.payout_account_name ?? ""})${p.payout_branch ? ` • ${p.payout_branch}` : ""}`;
}

export default function LoanForm({ onAddLoan }) {
  const { user, isActive, isAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    amount: "",
    duration: "1_week",
    purpose: "",
    nationalId: null,
    payoutMethod: "mobile_money",
    payoutProvider: "",
    payoutAccountName: "",
    payoutAccountNumber: "",
    payoutBranch: "",
  });

  // "Use last details" feature: prefill from most recent application
  // that already has payout details. Borrower can keep them or switch
  // to entering different details.
  const [lastPayout, setLastPayout] = useState(null);
  const [useLast, setUseLast] = useState(false);
  const [loadingLast, setLoadingLast] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadLast = async () => {
      setLoadingLast(true);
      const { data } = await supabase
        .from("loan_applications")
        .select(
          "payout_method, payout_provider, payout_account_name, payout_account_number, payout_branch"
        )
        .eq("user_id", user.id)
        .not("payout_method", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.payout_method) {
        setLastPayout(data);
        setUseLast(true);
        // Prefill the editable copy too, so "enter different" starts
        // from familiar values instead of a blank form.
        setFormData((prev) => ({
          ...prev,
          payoutMethod: data.payout_method,
          payoutProvider: data.payout_provider ?? "",
          payoutAccountName: data.payout_account_name ?? "",
          payoutAccountNumber: data.payout_account_number ?? "",
          payoutBranch: data.payout_branch ?? "",
        }));
      }
      setLoadingLast(false);
    };
    loadLast();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const setPayoutMethod = (method) => {
    setFormData((prev) => ({
      ...prev,
      payoutMethod: method,
      // Clear provider when switching groups so a stale bank value
      // can never be submitted as a mobile-money provider.
      payoutProvider: "",
    }));
  };

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const { interest, totalRepayment, repaymentDate } = useMemo(() => {
    const amount = Number(formData.amount);
    if (!amount || !formData.duration) {
      return { interest: 0, totalRepayment: 0, repaymentDate: "" };
    }
    const rate = DURATION_RATES[formData.duration];
    const interest = Number((amount * rate).toFixed(2));
    const totalRepayment = Number((amount + interest).toFixed(2));
    const date = new Date();
    const days = DURATION_DAYS[formData.duration];
    if (days > 0) {
      date.setDate(date.getDate() + days);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    const repaymentDate = date.toISOString().split("T")[0];
    return { interest, totalRepayment, repaymentDate };
  }, [formData.amount, formData.duration]);

  const validatePayout = (p) => {
    if (!p.payoutMethod || !["mobile_money", "bank"].includes(p.payoutMethod)) {
      return "Please choose how you want to receive the funds.";
    }
    if (!p.payoutProvider) {
      return p.payoutMethod === "bank"
        ? "Please choose your bank."
        : "Please choose your mobile money provider.";
    }
    if (!p.payoutAccountName?.trim()) {
      return p.payoutMethod === "bank"
        ? "Please enter the bank account name."
        : "Please enter the registered mobile money name.";
    }
    if (!p.payoutAccountNumber?.trim()) {
      return p.payoutMethod === "bank"
        ? "Please enter the bank account number."
        : "Please enter the mobile money phone number.";
    }
    if (
      p.payoutMethod === "mobile_money" &&
      p.payoutAccountNumber.replace(/\D/g, "").length < 9
    ) {
      return "Please enter a valid phone number for mobile money.";
    }
    if (p.payoutMethod === "bank" && !p.payoutBranch?.trim()) {
      return "Please enter the bank branch.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setMessage("Please log in to submit an application.");
      return;
    }
    if (!isActive && !isAdmin) {
      setMessage("Your account is pending activation by an admin.");
      return;
    }
    if (
      !formData.name ||
      !formData.amount ||
      !formData.duration ||
      !formData.nationalId
    ) {
      alert("Please fill in all required fields and upload your ID.");
      return;
    }

    // Effective payout: last-used values when the borrower kept them,
    // otherwise whatever is in the form.
    const effectivePayout = useLast && lastPayout
      ? {
          payoutMethod: lastPayout.payout_method,
          payoutProvider: lastPayout.payout_provider,
          payoutAccountName: lastPayout.payout_account_name,
          payoutAccountNumber: lastPayout.payout_account_number,
          payoutBranch: lastPayout.payout_branch ?? "",
        }
      : {
          payoutMethod: formData.payoutMethod,
          payoutProvider: formData.payoutProvider,
          payoutAccountName: formData.payoutAccountName?.trim(),
          payoutAccountNumber: formData.payoutAccountNumber?.trim(),
          payoutBranch:
            formData.payoutMethod === "bank" ? formData.payoutBranch?.trim() : null,
        };

    const payoutError = validatePayout(effectivePayout);
    if (payoutError) {
      setMessage(payoutError);
      return;
    }

    const { data: activeLoan } = await supabase
      .from("loan_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved", "confirmed", "edit_requested"])
      .maybeSingle();

    if (activeLoan) {
      const statusMsg = activeLoan.status === "pending" ? "pending approval" : "active";
      setMessage(
        `You already have a ${statusMsg} loan. Please repay it before applying for a new one.`
      );
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const file = formData.nationalId;
      const path = `${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("ids")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("loan_applications")
        .insert({
          user_id: user.id,
          borrower_name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          amount: Number(formData.amount),
          duration: formData.duration,
          interest_rate: DURATION_RATES[formData.duration],
          interest_amount: interest,
          total_repayment: totalRepayment,
          repayment_date: repaymentDate,
          purpose: formData.purpose || null,
          national_id_path: path,
          national_id_original: file.name,
          payout_method: effectivePayout.payoutMethod,
          payout_provider: effectivePayout.payoutProvider,
          payout_account_name: effectivePayout.payoutAccountName,
          payout_account_number: effectivePayout.payoutAccountNumber,
          payout_branch: effectivePayout.payoutBranch || null,
          status: "pending",
          processed_by: null,
        })
        .select()
        .single();
      if (error) throw error;

      onAddLoan({ ...formData, status: "pending", id: data.id });
      setMessage("Application submitted successfully!");
      setFormData({
        name: "",
        email: "",
        phone: "",
        amount: "",
        duration: "1_week",
        purpose: "",
        nationalId: null,
        payoutMethod: effectivePayout.payoutMethod,
        payoutProvider: effectivePayout.payoutProvider,
        payoutAccountName: effectivePayout.payoutAccountName,
        payoutAccountNumber: effectivePayout.payoutAccountNumber,
        payoutBranch: effectivePayout.payoutBranch ?? "",
      });
      // The just-submitted details become the new "last used".
      setLastPayout({
        payout_method: effectivePayout.payoutMethod,
        payout_provider: effectivePayout.payoutProvider,
        payout_account_name: effectivePayout.payoutAccountName,
        payout_account_number: effectivePayout.payoutAccountNumber,
        payout_branch: effectivePayout.payoutBranch,
      });
      setUseLast(true);
    } catch (err) {
      setMessage(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatMwk = (val) => "Mwk " + Number(val || 0).toLocaleString();

  if (!user) {
    return (
      <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
        <h2 className="text-lg font-bold text-slate-800">Loan Application</h2>
        <p className="text-slate-600 text-sm">
          Please{" "}
          <Link to="/login" className="text-indigo-600 underline">
            log in
          </Link>{" "}
          or{" "}
          <Link to="/signup" className="text-indigo-600 underline">
            sign up
          </Link>{" "}
          to apply.
        </p>
      </div>
    );
  }

  if (!isActive && !isAdmin) {
    return (
      <div className="space-y-4 bg-amber-50 p-6 rounded-2xl border border-amber-200 text-center">
        <h2 className="text-lg font-bold text-slate-800">Pending activation</h2>
        <p className="text-slate-600 text-sm">
          Your account is awaiting admin activation. You&apos;ll be able to
          apply once activated.
        </p>
        <Link to="/pending" className="text-indigo-600 underline text-sm">
          View status
        </Link>
      </div>
    );
  }

  const providerOptions =
    formData.payoutMethod === "bank" ? BANK_PROVIDERS : MOBILE_PROVIDERS;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white p-6 rounded-lg shadow-md"
    >
      <h2 className="text-lg font-bold">Loan Application</h2>

      {/* Borrower Name */}
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={handleChange}
        placeholder="Full Name"
        className="w-full border rounded px-3 py-2"
        required
      />

      {/* Email */}
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Email Address"
        className="w-full border rounded px-3 py-2"
      />

      {/* Phone */}
      <input
        type="tel"
        name="phone"
        value={formData.phone}
        onChange={handleChange}
        placeholder="Phone Number"
        className="w-full border rounded px-3 py-2"
      />

      {/* Loan Amount */}
      <input
        type="number"
        name="amount"
        value={formData.amount}
        onChange={handleChange}
        placeholder="Loan Amount"
        className="w-full border rounded px-3 py-2"
        required
      />

      {/* Loan Duration */}
      <select
        name="duration"
        value={formData.duration}
        onChange={handleChange}
        className="w-full border rounded px-3 py-2"
        required
      >
        <option value="1_week">1 Week (15% interest)</option>
        <option value="2_weeks">2 Weeks (30% interest)</option>
        <option value="1_month">1 Month (60% interest)</option>
      </select>

      {/* Auto-calculated interest + repayment date */}
      {formData.amount && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
          <p>Interest: {formatMwk(interest)}</p>
          <p>Repayment date: {repaymentDate}</p>
        </div>
      )}

      {/* Purpose */}
      <textarea
        name="purpose"
        value={formData.purpose}
        onChange={handleChange}
        placeholder="Purpose of Loan"
        className="w-full border rounded px-3 py-2"
      />

      {/* ---- Preferred payment details ---- */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-slate-800">
          Where should we send the money? <span className="text-red-500">*</span>
        </h3>

        {loadingLast ? (
          <p className="text-sm text-slate-500">Checking last payment details…</p>
        ) : lastPayout ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-slate-600">
              Last used: <span className="font-medium text-slate-800">{payoutSummary(lastPayout)}</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setUseLast(true)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  useLast
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                Use same details
              </button>
              <button
                type="button"
                onClick={() => setUseLast(false)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  !useLast
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                Enter different details
              </button>
            </div>
          </div>
        ) : null}

        {(!lastPayout || !useLast) && (
          <>
            {/* Method tabs: Mobile Money | Bank */}
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Payment method">
              {[
                { id: "mobile_money", label: "📱 Mobile Money" },
                { id: "bank", label: "🏦 Bank" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={formData.payoutMethod === m.id}
                  onClick={() => setPayoutMethod(m.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
                    formData.payoutMethod === m.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Provider options pop up below the tabs */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {formData.payoutMethod === "bank"
                  ? "Choose your bank"
                  : "Choose provider"}
              </p>
              <div className="flex gap-2 flex-wrap">
                {providerOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, payoutProvider: p.id }))
                    }
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      formData.payoutProvider === p.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Account fields */}
            {formData.payoutMethod === "mobile_money" ? (
              <div className="space-y-3">
                <input
                  type="tel"
                  name="payoutAccountNumber"
                  value={formData.payoutAccountNumber}
                  onChange={handleChange}
                  placeholder="Mobile money phone number (e.g. 0888 123 456)"
                  className="w-full border rounded px-3 py-2"
                  required
                />
                <input
                  type="text"
                  name="payoutAccountName"
                  value={formData.payoutAccountName}
                  onChange={handleChange}
                  placeholder="Registered name on the account"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  name="payoutAccountNumber"
                  value={formData.payoutAccountNumber}
                  onChange={handleChange}
                  placeholder="Bank account number"
                  className="w-full border rounded px-3 py-2"
                  required
                />
                <input
                  type="text"
                  name="payoutAccountName"
                  value={formData.payoutAccountName}
                  onChange={handleChange}
                  placeholder="Account name"
                  className="w-full border rounded px-3 py-2"
                  required
                />
                <input
                  type="text"
                  name="payoutBranch"
                  value={formData.payoutBranch}
                  onChange={handleChange}
                  placeholder="Branch (e.g. Lilongwe)"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* National ID Upload */}
      <div>
        <label className="block mb-1 font-medium">Upload National ID (PDF/JPG/PNG)</label>
        <input
          type="file"
          name="nationalId"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
          className="w-full"
          required
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Application"}
      </button>

      {message && (
        <p className="text-sm text-center text-green-700 font-medium">
          {message}
        </p>
      )}
    </form>
  );
}
