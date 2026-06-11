import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  MATCH_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  userNeedsPlanSelection
} from "../lib/onboardingRoutes.js";

/** Requires login + plan. Match onboarding is enforced after login, not on every dashboard page. */
export default function RequirePlanGuard({ children }) {
  const { user, ready } = useAuth();
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

  if (userNeedsPlanSelection(user)) {
    return <Navigate to={PLAN_SELECTION_PATH} replace />;
  }

  return children;
}
