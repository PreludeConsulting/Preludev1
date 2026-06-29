import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { canAccessDashboardRole, dashboardHomeForRole } from "../../lib/dashboardRoutes.js";

export default function RoleGuard({ role, children }) {
  const { user, ready, verificationRequired, loginVerificationLoading } = useAuth();

  if (!ready) {
    return (
      <div className="dash-loading">
        <p>Loading your Prelude dashboard…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loginVerificationLoading) {
    return (
      <div className="dash-loading">
        <p>Checking your trusted device…</p>
      </div>
    );
  }

  if (verificationRequired) {
    return <Navigate to="/verify-login" replace />;
  }

  if (!canAccessDashboardRole(user, role)) {
    return <Navigate to={dashboardHomeForRole(user.role)} replace />;
  }

  return children;
}
