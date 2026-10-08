import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import ApplyLoan from "./pages/ApplyLoan";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Signup from "./pages/Signup";
import PendingActivation from "./pages/PendingActivation";
import UserDashboard from "./pages/UserDashboard";
import UserManagement from "./pages/UserManagement";
import Landing from "./pages/Landing";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./auth/AuthContext";

function AppContent() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navbar />
        <div className="p-4 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pending" element={<PendingActivation />} />
            {/* Private admin entry point (unlinked from public UI).
                Local: http://localhost:5173/admin/login
                Vercel: https://<your-app>.vercel.app/admin/login */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/apply"
              element={
                <ProtectedRoute requiredRole={null} requireActive>
                  <ApplyLoan onAddLoan={() => {}} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loans"
              element={
                <ProtectedRoute requiredRole={null} requireActive>
                  <UserDashboard initialTab="loans" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute
                  requiredRole="admin"
                  loginRedirect="/admin/login"
                >
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute
                  requiredRole="admin"
                  loginRedirect="/admin/login"
                >
                  <UserManagement />
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
