import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoadingState from "./AuthLoadingState.jsx";
import {
  canAccessDashboard,
  postAuthDestination
} from "../lib/onboardingRoutes.js";
import {
  confirmOnboardingCheckoutSession,
  writePaymentStepComplete
} from "../lib/onboardingPayment.js";

/** Requires login + completed onboarding before dashboard access. */
export default function RequirePlanGuard({ children }) {
  const { user, ready, refreshUser, verificationRequired, emailConfirmationRequired } = useAuth();
  const location = useLocation();
  const sessionId = new URLSearchParams(location.search || "").get("session_id")
    || new URLSearchParams(location.search || "").get("sessionId");
  const [syncingCheckout, setSyncingCheckout] = useState(Boolean(sessionId && user && !user.paymentStepComplete));

  useEffect(() => {
    if (!ready || !user || !sessionId || user.paymentStepComplete) {
      setSyncingCheckout(false);
      return undefined;
    }

    let cancelled = false;
    setSyncingCheckout(true);

    (async () => {
      try {
        const result = await confirmOnboardingCheckoutSession(sessionId);
        if (cancelled) return;
        if (result?.confirmed) {
          writePaymentStepComplete(user.id);
          await refreshUser?.();
        }
      } catch {
        // Webhook may still complete the payment step; fall through to normal gate.
      } finally {
        if (!cancelled) setSyncingCheckout(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, refreshUser, sessionId, user, user?.id, user?.paymentStepComplete]);

  if (!ready || syncingCheckout) {
    return (
      <AuthLoadingState
        title="Loading your Prelude dashboard"
        message={
          syncingCheckout
            ? "Confirming your Stripe payment and unlocking your account…"
            : "We are restoring your account, plan, and onboarding state."
        }
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (emailConfirmationRequired) {
    return <Navigate to="/verify-email" replace />;
  }

  if (verificationRequired) {
    return <Navigate to={`/verify-login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  }

  if (!canAccessDashboard(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  return children;
}
