import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoanForm from "./components/LoanForm";
import ApplyLoan from "./pages/ApplyLoan";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";

function AppContent() {
  const { admin } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar admin={admin} />
        <div className="p-4 max-w-4xl mx-auto">
          <Routes>
            <Route
              path="/"
              element={
                <div className="min-h-screen bg-gray-100 p-6">
                  <div className="flex flex-col md:flex-row items-stretch max-w-6xl mx-auto gap-6">
                    <div className="md:w-1/2 bg-green-900">
                      <img
                        src="/kuwala-loan.png"
                        alt="Kuwala Loan Agency"
                        className="w-full h-full object-contain rounded-lg shadow-md"
                      />
                    </div>
                    <div className="md:w-1/2 bg-white p-6 rounded-lg shadow-md flex flex-col">
                      <h1 className="text-2xl font-bold mb-4">Apply for a Loan</h1>
                      <p className="text-gray-600 mb-6">
                        Fill out the form below to submit your loan application.
                      </p>
                      <div className="flex-grow">
                        <LoanForm onAddLoan={() => {}} />
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
            <Route path="/apply" element={<ApplyLoan onAddLoan={() => {}} />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
