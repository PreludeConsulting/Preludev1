import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoadingState from "./AuthLoadingState.jsx";
import {
  canAccessDashboard,
  postAuthDestination
} from "../lib/onboardingRoutes.js";

/** Requires login + completed onboarding before dashboard access. */
export default function RequirePlanGuard({ children }) {
  const { user, ready, verificationRequired } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <AuthLoadingState
        title="Loading your Prelude dashboard"
        message="We are restoring your account, plan, and onboarding state."
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (verificationRequired) {
    return <Navigate to={`/verify-login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!canAccessDashboard(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  return children;
}
