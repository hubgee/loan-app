import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoanForm from "./components/LoanForm";
import LoanTracker from "./components/LoanTracker";
import ApplyLoan from "./pages/ApplyLoan";
import Dashboard from "./pages/Dashboard";
import { useState } from "react";

function App() {
  const [loans, setLoans] = useState([]);

  const addLoan = (loan) => setLoans([...loans, loan]);
  const updateLoan = (index, updatedLoan) => {
    const newLoans = [...loans];
    newLoans[index] = updatedLoan;
    setLoans(newLoans);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="p-4 max-w-4xl mx-auto">
          <Routes>
            <Route
              path="/"
              element={
                <div className="space-y-6">
                  <LoanForm onAddLoan={addLoan} />
                  <LoanTracker loans={loans} onUpdateLoan={updateLoan} />
                </div>
              }
            />
            <Route path="/apply" element={<ApplyLoan onAddLoan={addLoan} />} />
            <Route
              path="/dashboard"
              element={<Dashboard loans={loans} onUpdateLoan={updateLoan} />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
