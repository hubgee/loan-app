import { useState } from "react";

export default function LoanForm({ onAddLoan }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !amount) return;

    // Add loan to parent state
    onAddLoan({ name, amount, status: "Pending" });

    // Reset form
    setName("");
    setAmount("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded-lg shadow-md space-y-4"
    >
      <h2 className="text-lg font-bold">Apply for a Loan</h2>

      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-3 border rounded focus:ring focus:ring-blue-300"
        required
      />

      <input
        type="number"
        placeholder="Loan Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-3 border rounded focus:ring focus:ring-blue-300"
        required
      />

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 transition"
      >
        Submit
      </button>
    </form>
  );
}
