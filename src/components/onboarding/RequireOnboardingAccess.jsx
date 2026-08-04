import { Navigate, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthLoadingState from "../AuthLoadingState.jsx";
import { canAccessOnboardingPath, isOnboardingComplete } from "../../lib/onboardingFlow.js";
import { postAuthDestination, ROLE_SELECTION_PATH, userCanChangeRoleDuringOnboarding } from "../../lib/onboardingRoutes.js";

export default function RequireOnboardingAccess({ children }) {
  const { user, ready, emailConfirmationRequired } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  if (!ready) {
    return (
      <AuthLoadingState
        title="Preparing your Prelude setup"
        message="We are restoring your account and onboarding progress."
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (emailConfirmationRequired) {
    return <Navigate to="/verify-email" replace />;
  }

  // Authenticated onboarding must not bounce mid-flow to login OTP.
  // Confirmed sessions stay on onboarding steps through refresh and Stripe returns.

  if (location.pathname === ROLE_SELECTION_PATH && userCanChangeRoleDuringOnboarding(user)) {
    return children;
  }

  if (isOnboardingComplete(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  if (!canAccessOnboardingPath(user, location.pathname, searchParams)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  return children;
}
