import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import SessionRetryScreen from "./SessionRetryScreen";

function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-600 dark:text-slate-400">Loading...</p>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requireActive = false,
  loginRedirect = "/login",
}) {
  const { status, authError, isAdmin, isActive, retryAuth } = useAuth();

  // Branch order is the whole fix. `error` must be evaluated BEFORE
  // `anonymous`, otherwise a failed session check still redirects to the
  // login form and the rate-limit -> logout loop is unchanged.
  if (status === "initializing") {
    return <FullPageSpinner />;
  }

  if (status === "error") {
    return (
      <SessionRetryScreen message={authError} onRetry={retryAuth} />
    );
  }

  if (status === "anonymous") {
    return <Navigate to={loginRedirect} replace />;
  }

  const role = requiredRole === undefined ? "admin" : requiredRole;

  if (role === "admin" && !isAdmin) {
    return <Navigate to={isActive ? "/loans" : "/pending"} replace />;
  }

  if (role === "borrower" && isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireActive && !isActive && !isAdmin) {
    return <Navigate to="/pending" replace />;
  }

  return children;
}