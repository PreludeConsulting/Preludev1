import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthLoadingState from "../../components/AuthLoadingState.jsx";
import { canAccessDashboardRole, dashboardHomeForUser } from "../../lib/dashboardRoutes.js";

export default function RoleGuard({ role, children }) {
  const { user, ready, verificationRequired } = useAuth();

  if (!ready) {
    return (
      <AuthLoadingState
        title="Loading your Prelude dashboard"
        message="We are restoring your secure dashboard access."
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (verificationRequired) {
    return <Navigate to="/verify-login" replace />;
  }

  if (!canAccessDashboardRole(user, role)) {
    return <Navigate to={dashboardHomeForUser(user)} replace />;
  }

  return children;
}
