import { Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthLoadingState from "../../components/AuthLoadingState.jsx";
import { canAccessDashboardRole, dashboardHomeForUser } from "../../lib/dashboardRoutes.js";

export default function RoleGuard({ role, children, allowAuthenticated = false }) {
  const { user, ready, verificationRequired, emailConfirmationRequired } = useAuth();

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

  if (emailConfirmationRequired) {
    return <Navigate to="/verify-email" replace />;
  }

  if (verificationRequired) {
    return <Navigate to="/verify-login" replace />;
  }

  if (!allowAuthenticated && !canAccessDashboardRole(user, role)) {
    return <Navigate to={dashboardHomeForUser(user)} replace />;
  }

  return children;
}
