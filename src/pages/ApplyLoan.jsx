// src/pages/ApplyLoan.jsx

import LoanForm from "../components/LoanForm";

export default function ApplyLoan({ onAddLoan }) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-6">
  <div className="flex flex-col md:flex-row items-stretch max-w-6xl mx-auto gap-6">
    {/* Image Section */}
    <div className="md:w-1/2 bg-green-900">
      <img
        src="/kuwala-loan.png"
        alt="Kuwala Loan Agency"
        className="w-full h-full object-contain rounded-lg shadow-md"
      />
    </div>
    
    {/* Form Section */}
    <div className="md:w-1/2 bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md flex flex-col border border-slate-200 dark:border-slate-700">
      <h1 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">Apply for a Loan</h1>
      <p className="text-gray-600 dark:text-slate-300 mb-6">
        Fill out the form below to submit your loan application.
      </p>
      <div className="grow">
        <LoanForm onAddLoan={onAddLoan} />
      </div>
    </div>
  </div>
</div>
  );
}
