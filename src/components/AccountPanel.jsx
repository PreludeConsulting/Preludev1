import { CheckCircle, CreditCard, LogOut, MessageCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { openBillingPortal } from "../lib/auth.js";
import { PRELUDE_AI_NAME } from "../lib/preludeAi.js";

export default function AccountPanel({ onOpenPersonalizedAi }) {
  const { accountOpen, closeModals, user, planDetails, signOut } = useAuth();
  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);

  if (!accountOpen || !user || !planDetails) return null;

  async function handleManageBilling() {
    setBillingLoading(true);
    setBillingMessage("");
    try {
      const result = await openBillingPortal();
      if (result.url) window.location.href = result.url;
    } catch (error) {
      setBillingMessage(error.payload?.message || error.message || "Billing is not available yet.");
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <div className="prelude-modal-backdrop" role="presentation" onClick={closeModals}>
      <motion.div
        className="prelude-modal paper-card"
        role="dialog"
        aria-labelledby="account-title"
        aria-modal="true"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="account-title" className="subheading text-2xl">
                {user.name}
              </h2>
              <p className="font-body text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-foreground/5" onClick={closeModals} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-foreground/12 bg-background/60 p-4">
            <p className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">Membership plan</p>
            <p className="subheading mt-1 text-4xl">{planDetails.name}</p>
            <p className="mt-2 font-body text-sm text-muted-foreground">{planDetails.tagline}</p>
            <p className="mt-3 font-body text-xs text-muted-foreground">
              Plans change software and mentor access - {PRELUDE_AI_NAME} is the same for everyone.
            </p>
            {user.subscriptionStatus ? (
              <p className="mt-2 font-body text-xs text-muted-foreground">Billing status: {user.subscriptionStatus}</p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 font-body text-sm font-medium text-foreground">{PRELUDE_AI_NAME} helps you with</p>
            <ul className="grid gap-2">
              {[
                "Central application dashboard",
                "Deadline tracking",
                "Essay prompt organization",
                "Profile analyzer",
                "Strength and opportunity suggestions",
                "Scholarship and financial aid reminders"
              ].map((item) => (
                <li className="flex gap-2 font-body text-sm text-muted-foreground" key={item}>
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 font-body text-sm font-medium text-foreground">Software & roadmap</p>
            <ul className="grid gap-2">
              {planDetails.softwareAccess.map((item) => (
                <li className="flex gap-2 font-body text-sm text-muted-foreground" key={item}>
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 font-body text-sm font-medium text-foreground">Mentor access</p>
            <ul className="grid gap-2">
              <li className="flex gap-2 font-body text-sm text-muted-foreground">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {planDetails.mentorSessions}
              </li>
              <li className="flex gap-2 font-body text-sm text-muted-foreground">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {planDetails.messaging}
              </li>
              {planDetails.mentorExtras.map((item) => (
                <li className="flex gap-2 font-body text-sm text-muted-foreground" key={item}>
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {user.focus ? (
            <p className="rounded-xl border border-foreground/10 bg-muted/40 px-4 py-3 font-body text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Your focus:</span> {user.focus}
            </p>
          ) : null}

          {user.hasBillingCustomer ? (
            <div className="space-y-2">
              <button
                type="button"
                className="prelude-btn-primary flex w-full items-center justify-center gap-2"
                onClick={handleManageBilling}
                disabled={billingLoading}
              >
                <CreditCard className="h-4 w-4" />
                {billingLoading ? "Opening billing..." : "Manage billing"}
              </button>
              {billingMessage ? <p className="font-body text-xs text-muted-foreground">{billingMessage}</p> : null}
            </div>
          ) : null}

          <button
            type="button"
            className="prelude-btn-primary flex w-full items-center justify-center gap-2"
            onClick={() => {
              closeModals();
              onOpenPersonalizedAi?.();
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Open {PRELUDE_AI_NAME}
          </button>

          <div className="flex flex-wrap gap-3 border-t border-foreground/10 pt-4">
            <a href="#pricing" className="font-body text-sm text-foreground/80 underline underline-offset-2" onClick={closeModals}>
              Compare plans
            </a>
            <a href="#dashboard" className="font-body text-sm text-foreground/80 underline underline-offset-2" onClick={closeModals}>
              My roadmap
            </a>
            <a href="#preludematch" className="font-body text-sm text-foreground/80 underline underline-offset-2" onClick={closeModals}>
              PreludeMatch
            </a>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 font-body text-sm text-muted-foreground hover:text-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
