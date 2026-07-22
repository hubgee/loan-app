// src/components/LoanForm.jsx
import { useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";

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

export default function LoanForm({ onAddLoan }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    amount: "",
    duration: "1_week",
    purpose: "",
    nationalId: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.amount ||
      !formData.duration ||
      !formData.nationalId
    ) {
      alert("Please fill in all required fields and upload your ID.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const file = formData.nationalId;
      const path = `ids/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("ids")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("loan_applications")
        .insert({
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
          status: "Pending",
        })
        .select()
        .single();
      if (error) throw error;

      onAddLoan({ ...formData, status: "Pending", id: data.id });
      setMessage("Application submitted successfully!");
      setFormData({
        name: "",
        email: "",
        phone: "",
        amount: "",
        duration: "1_week",
        purpose: "",
        nationalId: null,
      });
    } catch (err) {
      setMessage(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatMwk = (val) => "Mwk " + Number(val || 0).toLocaleString();

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
