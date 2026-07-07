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
                <div className="space-y-6">
                  <LoanForm onAddLoan={() => {}} />
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
