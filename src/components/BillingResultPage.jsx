import { useEffect, useState } from "react";
import { CheckCircle, CreditCard, Loader2, XCircle } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getPlan } from "../lib/plans.js";
import { PAYMENT_ONBOARDING_PATH, dashboardPathForRole } from "../lib/onboardingRoutes.js";
import { confirmOnboardingCheckoutSession, writePaymentStepComplete } from "../lib/onboardingPayment.js";
import { Button } from "./ui/button.jsx";

const CONFIRM_POLL_MS = 2000;
const CONFIRM_TIMEOUT_MS = 60000;

function useOnboardingCheckoutConfirmation(sessionId, enabled) {
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState(enabled ? "confirming" : "idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !sessionId) return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = Math.ceil(CONFIRM_TIMEOUT_MS / CONFIRM_POLL_MS);

    async function confirmOnce() {
      try {
        await confirmOnboardingCheckoutSession(sessionId);
      } catch (err) {
        if (!cancelled && attempts === 0) {
          setError(err.message || "Could not confirm checkout yet.");
        }
      }

      const refreshed = await refreshUser();
      if (cancelled) return;

      if (refreshed?.paymentStepComplete) {
        if (refreshed.id) writePaymentStepComplete(refreshed.id);
        setStatus("confirmed");
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        setStatus("timeout");
        return;
      }

      window.setTimeout(confirmOnce, CONFIRM_POLL_MS);
    }

    confirmOnce();
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshUser, sessionId]);

  useEffect(() => {
    if (enabled && user?.paymentStepComplete) {
      setStatus("confirmed");
    }
  }, [enabled, user?.paymentStepComplete]);

  return { status, error };
}

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const plan = getPlan(params.get("plan") || "basic");
  const context = params.get("context");
  const sessionId = params.get("session_id");
  const isOnboarding = context === "onboarding";
  const { status, error } = useOnboardingCheckoutConfirmation(sessionId, isOnboarding);

  if (isOnboarding && status === "confirmed") {
    return <Navigate to={dashboardPathForRole("student")} replace />;
  }

  if (isOnboarding) {
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
            {status === "confirming" ? "Almost there" : `Welcome to ${plan.name}`}
          </h1>
          <p className="mt-5 max-w-xl font-body text-base leading-7 text-muted-foreground">
            {status === "confirming"
              ? "Stripe confirmed your checkout. We're activating your Prelude account now — this usually takes a few seconds."
              : "Your payment was received. Return to plan selection if activation is taking longer than expected."}
          </p>
          {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}
          {status === "timeout" ? (
            <div className="mt-8">
              <Button as={Link} to={PAYMENT_ONBOARDING_PATH} variant="primary">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Back to plan selection
              </Button>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-20 text-foreground">
      <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <CheckCircle className="h-12 w-12 text-primary" aria-hidden="true" />
        <p className="mt-6 font-body text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Checkout complete
        </p>
        <h1 className="shopify-hero__headline mt-4 text-5xl font-black leading-none md:text-7xl">
          Welcome to {plan.name}
        </h1>
        <p className="mt-5 max-w-xl font-body text-base leading-7 text-muted-foreground">
          Stripe confirmed your checkout. Your account plan updates from the webhook once Stripe sends the subscription event.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button as={Link} to={dashboardPathForRole("student")} variant="primary">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Go to dashboard
          </Button>
          <Button as={Link} to="/#pricing" variant="secondary">
            View plans
          </Button>
        </div>
      </section>
    </main>
  );
}

export function CheckoutCancelPage() {
  const [params] = useSearchParams();
  const plan = getPlan(params.get("plan") || "basic");
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
            {plan.name} is still waiting
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
          {plan.name} is still waiting
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
