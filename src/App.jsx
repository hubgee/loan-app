import { useState } from "react";
import Navbar from "./components/Navbar";
import LoanForm from "./components/LoanForm";
import LoanList from "./components/LoanTracker";

function App() {
  const [loans, setLoans] = useState([]);

  const addLoan = (loan) => setLoans([...loans, loan]);

  const updateLoan = (index, updatedLoan) => {
    const newLoans = [...loans];
    newLoans[index] = updatedLoan;
    setLoans(newLoans);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar at the top */}
      <Navbar />

      {/* Main content */}
      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* Loan application form */}
        <LoanForm onAddLoan={addLoan} />

        {/* Loan tracking list */}
        <LoanList loans={loans} />
      </div>
    </div>
  );
}

export default App;

