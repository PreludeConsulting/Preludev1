import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";
import AuthLoadingState from "./AuthLoadingState.jsx";
import { STUDENT_BILLING_PATH, STUDENT_BILLING_PLANS_PATH } from "../../shared/stripePaymentLinks.js";

const ALLOWED_PREFIXES = [
  STUDENT_BILLING_PATH,
  STUDENT_BILLING_PLANS_PATH,
  "/dashboard/student/settings",
  "/checkout/"
];

function isAllowlistedPath(pathname) {
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix)
  );
}

function hasDashboardPurchaseAccess(user, subscription) {
  if (subscription?.isActive || subscription?.dashboardAccess || subscription?.essaySupportAccess) {
    return true;
  }
  // Essay Support (and other one-time) onboarding payments unlock the dashboard even
  // before review-credit rows finish replicating from the Stripe webhook.
  if (user?.paymentStepComplete) {
    const planId = String(subscription?.activePlanId || user?.plan || "basic").toLowerCase();
    if (planId === "basic" || planId === "none" || !planId) return true;
  }
  return false;
}

/**
 * Locks students without a completed purchase out of the main dashboard.
 * Plus/Pro subscribers and Essay Support buyers are allowed through.
 * Mentors, admins, and parents are never forced through this lock.
 */
export default function RequireActiveMembershipGuard({ children }) {
  const { user, ready } = useAuth();
  const { subscription, loading, syncing } = useSubscription();
  const location = useLocation();

  if (!ready || (user && loading && !subscription)) {
    return (
      <AuthLoadingState
        title="Checking your membership"
        message={syncing ? "Syncing your plan…" : "We are confirming your Prelude plan access."}
      />
    );
  }

  const role = String(user?.role || "").toLowerCase();
  if (role !== "student") return children;

  if (isAllowlistedPath(location.pathname)) return children;

  // Wait for first subscription payload before locking.
  if (!subscription) return children;

  if (hasDashboardPurchaseAccess(user, subscription)) return children;

  if (syncing) {
    return (
      <AuthLoadingState title="Syncing your plan…" message="Stripe confirmed a change — updating your dashboard." />
    );
  }

  return (
    <Navigate
      to={STUDENT_BILLING_PATH}
      replace
      state={{ from: location.pathname, membershipLocked: true }}
    />
  );
}
