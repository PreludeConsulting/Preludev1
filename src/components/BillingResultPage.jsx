import { CheckCircle, CreditCard, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { getPlan } from "../lib/plans.js";
import { Button } from "./ui/button.jsx";

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const plan = getPlan(params.get("plan") || "basic");

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
          <Button as={Link} to="/dashboard" variant="primary">
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
