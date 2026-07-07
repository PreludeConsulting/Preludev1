import { Navigate } from "react-router-dom";
import { useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  PARENT_ONBOARDING_PATH,
  PAYMENT_ONBOARDING_PATH,
  dashboardPathForRole,
  postAuthDestination,
  userNeedsPaymentStep
} from "../../lib/onboardingRoutes.js";
import { PlanWalletSelector } from "../PlanSelectionPage.jsx";
import OnboardingShell from "./OnboardingShell.jsx";

export default function PaymentOnboardingPage() {
  const { user, ready } = useAuth();
  const walletBackRef = useRef(null);

  if (!ready) {
    return (
      <OnboardingShell
        user={user}
        loading
        title="Choose your plan"
        subtitle="Preparing secure checkout…"
        hideContinue
        hideHomeLink
      />
    );
  }

  if (!user || user.role !== "student") {
    return <Navigate to={dashboardPathForRole(user?.role || "student")} replace />;
  }

  if (!userNeedsPaymentStep(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  return (
    <OnboardingShell
      user={user}
      title="Choose your Prelude plan"
      subtitle="Select one of the three mentorship tiers below. You'll complete secure checkout before your account is activated."
      eyebrow="Final step"
      hideContinue
      hideHomeLink
      onBack={(event) => walletBackRef.current?.(event)}
      footerNote="Your subscription starts after Stripe confirms payment. You cannot access your dashboard until checkout is complete."
    >
      <PlanWalletSelector
        context="payment"
        user={user}
        backTo={PARENT_ONBOARDING_PATH}
        onRegisterBack={(handler) => {
          walletBackRef.current = handler;
        }}
      />
    </OnboardingShell>
  );
}
