// src/components/LoanForm.jsx
import { useState } from "react";
import { api, getCsrf } from "../api/client";

export default function LoanForm({ onAddLoan }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    amount: "",
    purpose: "",
    nationalId: null, // file upload
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.nationalId) {
      alert("Please fill in all required fields and upload your ID.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      await getCsrf();
      const fd = new FormData();
      fd.append("name", formData.name);
      fd.append("email", formData.email);
      fd.append("phone", formData.phone);
      fd.append("amount", formData.amount);
      fd.append("purpose", formData.purpose);
      fd.append("nationalId", formData.nationalId);

      const res = await api.post("/loans", fd);
      onAddLoan({ ...formData, status: "Pending", id: res.data.application.id });
      setMessage("Application submitted successfully!");
      setFormData({
        name: "",
        email: "",
        phone: "",
        amount: "",
        purpose: "",
        nationalId: null,
      });
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Submission failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

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

