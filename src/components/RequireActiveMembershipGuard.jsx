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
  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix));
}

/**
 * Locks inactive students out of Plus/Pro dashboard routes.
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

  if (subscription.isActive) return children;

  if (syncing) {
    return (
      <AuthLoadingState title="Syncing your plan…" message="Stripe confirmed a change — updating your dashboard." />
    );
  }

  return <Navigate to={STUDENT_BILLING_PATH} replace state={{ from: location.pathname, membershipLocked: true }} />;
}
