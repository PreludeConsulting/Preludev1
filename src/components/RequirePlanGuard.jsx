import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  MENTOR_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  ROLE_SELECTION_PATH,
  userNeedsRoleSelection,
  userNeedsMentorOnboarding,
  userNeedsPlanSelection
} from "../lib/onboardingRoutes.js";

/** Requires login + plan. Match onboarding is enforced after login, not on every dashboard page. */
export default function RequirePlanGuard({ children }) {
  const { user, ready, verificationRequired, loginVerificationLoading } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="dash-loading">
        <p>Loading your Prelude dashboard…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (loginVerificationLoading) {
    return (
      <div className="dash-loading">
        <p>Checking your trusted device…</p>
      </div>
    );
  }

  if (verificationRequired) {
    return <Navigate to={`/verify-login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (userNeedsRoleSelection(user)) {
    return <Navigate to={ROLE_SELECTION_PATH} replace />;
  }

  if (userNeedsPlanSelection(user)) {
    return <Navigate to={PLAN_SELECTION_PATH} replace />;
  }

  if (userNeedsMentorOnboarding(user)) {
    return <Navigate to={MENTOR_ONBOARDING_PATH} replace />;
  }

  return children;
}
