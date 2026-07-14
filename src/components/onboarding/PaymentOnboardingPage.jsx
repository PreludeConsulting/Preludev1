import { Navigate, useLocation } from "react-router-dom";
import { useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  PARENT_ONBOARDING_PATH,
  dashboardPathForRole,
  postAuthDestination,
  userNeedsPaymentStep
} from "../../lib/onboardingRoutes.js";
import { peekPendingBundleIntent } from "../../lib/bundlePurchaseIntent.js";
import { PlanWalletSelector } from "../PlanSelectionPage.jsx";
import OnboardingShell from "./OnboardingShell.jsx";

export default function PaymentOnboardingPage() {
  const { user, ready } = useAuth();
  const walletBackRef = useRef(null);
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const isBundles =
    search.get("mode") === "bundles" ||
    location.state?.purchaseMode === "bundles" ||
    Boolean(peekPendingBundleIntent()?.bundleId);

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
      subtitle={
        isBundles
          ? "Pick a monthly mentorship plan or customize a one-time support bundle. Checkout is secure and one-time bundles never create a recurring subscription."
          : "Select one of the three mentorship tiers below. You'll complete secure checkout before your account is activated."
      }
      eyebrow="Final step"
      hideContinue
      hideHomeLink
      onBack={(event) => walletBackRef.current?.(event)}
      footerNote="Your subscription starts after Stripe confirms payment. One-time bundles are charged once. You cannot access your dashboard until checkout is complete."
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
