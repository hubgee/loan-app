// src/pages/ApplyLoan.jsx

import LoanForm from "../components/LoanForm";

export default function ApplyLoan({ onAddLoan }) {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Apply for a Loan</h1>
      <p className="text-gray-600 mb-6">
        Fill out the form below to submit your loan application.
      </p>
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <LoanForm onAddLoan={onAddLoan} />
      </div>
    </div>
  );
}
