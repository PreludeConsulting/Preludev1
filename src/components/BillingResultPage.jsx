import { useEffect, useState } from "react";
import { CheckCircle, CreditCard, Loader2, XCircle } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import { getPlan } from "../lib/plans.js";
import { PAYMENT_ONBOARDING_PATH, dashboardPathForRole } from "../lib/onboardingRoutes.js";
import { confirmOnboardingCheckoutSession, writePaymentStepComplete } from "../lib/onboardingPayment.js";
import { clearPendingBundleIntent } from "../lib/bundlePurchaseIntent.js";
import { Button } from "./ui/button.jsx";

const CONFIRM_POLL_MS = 2000;
const CONFIRM_TIMEOUT_MS = 60000;
const STUDENT_OVERVIEW_PATH = dashboardPathForRole("student");

function useCheckoutConfirmation(sessionId, enabled) {
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState(enabled ? "confirming" : "idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = Math.ceil(CONFIRM_TIMEOUT_MS / CONFIRM_POLL_MS);

    async function confirmOnce() {
      let confirmed = false;
      if (sessionId) {
        try {
          const result = await confirmOnboardingCheckoutSession(sessionId);
          confirmed = Boolean(result?.confirmed);
        } catch (err) {
          const pending = err?.payload?.error === "payment_pending" || err?.status === 409;
          if (!cancelled && attempts === 0 && !pending) {
            setError(err.message || "Could not confirm checkout yet.");
          }
        }
      }

      if (cancelled) return;

      const refreshed = await refreshUser().catch(() => null);
      if (cancelled) return;

      if (confirmed || refreshed?.paymentStepComplete || user?.paymentStepComplete) {
        const userId = refreshed?.id || user?.id;
        if (userId) writePaymentStepComplete(userId);
        setStatus("confirmed");
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        // Prefer the dashboard over plan selection once Stripe has returned the
        // buyer — webhooks may still be catching up.
        setStatus(sessionId ? "timeout" : "confirmed");
        return;
      }

      window.setTimeout(confirmOnce, CONFIRM_POLL_MS);
    }

    confirmOnce();
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshUser, sessionId, user?.id, user?.paymentStepComplete]);

  useEffect(() => {
    if (enabled && user?.paymentStepComplete) {
      setStatus("confirmed");
    }
  }, [enabled, user?.paymentStepComplete]);

  return { status, error };
}

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const checkoutProduct = params.get("plan") || "";
  const isBundle = checkoutProduct.startsWith("bundle_") || checkoutProduct === "essay_support";
  const plan = getPlan(checkoutProduct || "basic");
  const productName =
    checkoutProduct === "bundle_essay_support" || checkoutProduct === "essay_support"
      ? "Essay Support"
      : plan.name;
  const context = params.get("context");
  const sessionId = params.get("session_id") || params.get("sessionId");
  const isOnboarding = context === "onboarding";
  // Always confirm when Stripe hands us a session, including $0 promo checkouts
  // and Payment Link returns that omit context=onboarding.
  const shouldConfirm = Boolean(sessionId) || isOnboarding || isBundle;
  const { status, error } = useCheckoutConfirmation(sessionId, shouldConfirm);

  useEffect(() => {
    if (isBundle && status === "confirmed") clearPendingBundleIntent();
  }, [isBundle, status]);

  if (status === "confirmed") {
    return <Navigate to={STUDENT_OVERVIEW_PATH} replace />;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-20 text-foreground">
      <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
        {status === "confirming" ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <CheckCircle className="h-12 w-12 text-primary" aria-hidden="true" />
        )}
        <p className="mt-6 font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          {status === "confirming" ? "Confirming payment" : "Checkout complete"}
        </p>
        <h1 className="shopify-hero__headline mt-4 text-5xl font-black leading-none md:text-7xl">
          {status === "confirming" ? "Almost there" : `Welcome to ${productName}`}
        </h1>
        <p className="mt-5 max-w-xl font-body text-base leading-7 text-muted-foreground">
          {status === "confirming"
            ? "Stripe confirmed your checkout. We're activating your Prelude account now — this usually takes a few seconds."
            : "Your payment was received. Continue to your dashboard while Prelude finishes syncing your plan or review credits."}
        </p>
        {/* Fully discounted ($0 / no_payment_required) checkouts are confirmed the same way as paid ones. */}
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {status === "timeout" ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to={STUDENT_OVERVIEW_PATH} variant="primary">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Go to dashboard
            </Button>
            {isOnboarding ? (
              <Button as={Link} to={PAYMENT_ONBOARDING_PATH} variant="secondary">
                Back to plan selection
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export function CheckoutCancelPage() {
  const [params] = useSearchParams();
  const checkoutProduct = params.get("plan") || "";
  const plan = getPlan(checkoutProduct || "basic");
  const productName =
    checkoutProduct === "bundle_essay_support" || checkoutProduct === "essay_support"
      ? "Essay Support"
      : plan.name;
  const isOnboarding = params.get("context") === "onboarding";

  if (isOnboarding) {
    return (
      <main className="min-h-screen bg-background px-6 py-20 text-foreground">
        <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <XCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-6 font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Checkout canceled
          </p>
          <h1 className="shopify-hero__headline mt-4 text-5xl font-black leading-none md:text-7xl">
            {productName} is still waiting
          </h1>
          <p className="mt-5 max-w-xl font-body text-base leading-7 text-muted-foreground">
            You were not charged. Choose a plan again to finish creating your Prelude account.
          </p>
          <div className="mt-8">
            <Button as={Link} to={PAYMENT_ONBOARDING_PATH} variant="primary">
              Back to plan selection
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-20 text-foreground">
      <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <XCircle className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <p className="mt-6 font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Checkout canceled
        </p>
        <h1 className="shopify-hero__headline mt-4 text-5xl font-black leading-none md:text-7xl">
          {productName} is still waiting
        </h1>
        <p className="mt-5 max-w-xl font-body text-base leading-7 text-muted-foreground">
          You were not charged. You can return to pricing whenever you are ready to finish checkout.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button as={Link} to="/#pricing" variant="primary">
            Return to pricing
          </Button>
          <Button as={Link} to="/" variant="secondary">
            Back home
          </Button>
        </div>
      </section>
    </main>
  );
}
