import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function ProtectedRoute({
  children,
  requiredRole,
  requireActive = false,
  loginRedirect = "/login",
}) {
  const { user, isAdmin, isActive, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginRedirect} replace />;
  }

  // Default (backward-compat): bare <ProtectedRoute> (undefined role) means admin-only.
  // Pass requiredRole={null} to allow any authenticated role (with optional active gate).
  const role = requiredRole === undefined ? "admin" : requiredRole;

  if (role === "admin" && !isAdmin) {
    // Borrower hitting an admin page -> send to their area
    return <Navigate to={isActive ? "/loans" : "/pending"} replace />;
  }

  if (role === "user" && isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // role === null: any authenticated user allowed (active gate below still applies)

  // Active gate: admins bypass (they are backfilled active=true anyway)
  if (requireActive && !isActive && !isAdmin) {
    return <Navigate to="/pending" replace />;
  }

  return children;
}
