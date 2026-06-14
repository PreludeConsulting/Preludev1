import { useEffect } from "react";
import {
  Bot,
  CheckCircle,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  Sparkles,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { openBillingPortal } from "../lib/auth.js";
import { dashboardHomeForRole } from "../lib/dashboardRoutes.js";
import { PRELUDE_AI_NAME } from "../lib/preludeAi.js";
import { useState } from "react";
import PlanBadge from "./PlanBadge.jsx";
import MembershipPlanCard from "./MembershipPlanCard.jsx";

function userInitial(name) {
  return ((name || "P").trim()[0] || "P").toUpperCase();
}

export default function MembershipDrawer({ onOpenPersonalizedAi }) {
  const { accountOpen, closeModals, user, planDetails, signOut } = useAuth();
  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeModals();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [accountOpen, closeModals]);

  if (!user || !planDetails) return null;

  const dashboardPath = dashboardHomeForRole(user.role);

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
    <AnimatePresence>
      {accountOpen ? (
        <div className="membership-drawer-backdrop" role="presentation" onClick={closeModals}>
          <motion.aside
            className="membership-drawer"
            role="dialog"
            aria-labelledby="membership-drawer-title"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="membership-drawer__header">
              <div className="membership-drawer__user">
                <span className="membership-drawer__avatar">{userInitial(user.name)}</span>
                <div className="membership-drawer__identity">
                  <h2 id="membership-drawer-title" className="membership-drawer__name">
                    {user.name}
                  </h2>
                  <p className="membership-drawer__email">{user.email}</p>
                </div>
              </div>
              <button type="button" className="membership-drawer__close" onClick={closeModals} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="membership-drawer__body">
              <MembershipPlanCard plan={planDetails} planId={user.plan} />

              {user.subscriptionStatus ? (
                <p className="membership-drawer__meta">Billing status: {user.subscriptionStatus}</p>
              ) : null}

              <section className="membership-drawer__section">
                <h3 className="membership-drawer__section-title">
                  <Bot className="h-4 w-4" /> {PRELUDE_AI_NAME} Tools
                </h3>
                <ul className="membership-drawer__list">
                  {planDetails.aiFeatures.map((item) => (
                    <li key={item}>
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="membership-drawer__section">
                <h3 className="membership-drawer__section-title">Software & Roadmap</h3>
                <ul className="membership-drawer__list">
                  {planDetails.softwareAccess.map((item) => (
                    <li key={item}>
                      <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="membership-drawer__section">
                <h3 className="membership-drawer__section-title">Mentor Access</h3>
                <ul className="membership-drawer__list">
                  <li>
                    <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                    {planDetails.mentorSessions}
                  </li>
                  <li>
                    <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                    {planDetails.messaging}
                  </li>
                  {planDetails.mentorExtras.map((item) => (
                    <li key={item}>
                      <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              {user.focus ? (
                <p className="membership-drawer__focus">
                  <span>Your focus:</span> {user.focus}
                </p>
              ) : null}

              {user.hasBillingCustomer ? (
                <button
                  type="button"
                  className="prelude-btn-secondary membership-drawer__btn"
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                >
                  <CreditCard className="h-4 w-4" />
                  {billingLoading ? "Opening billing…" : "Manage billing"}
                </button>
              ) : null}
              {billingMessage ? <p className="membership-drawer__meta">{billingMessage}</p> : null}
            </div>

            <footer className="membership-drawer__footer">
              <Link to={dashboardPath} className="prelude-btn-primary membership-drawer__btn" onClick={closeModals}>
                <LayoutDashboard className="h-4 w-4" />
                Go to Dashboard
              </Link>
              <a href="#pricing" className="prelude-btn-secondary membership-drawer__btn" onClick={closeModals}>
                View or Upgrade Plan
              </a>
              <button
                type="button"
                className="prelude-btn-secondary membership-drawer__btn"
                onClick={() => {
                  closeModals();
                  onOpenPersonalizedAi?.();
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Open {PRELUDE_AI_NAME}
              </button>
              <button type="button" className="membership-drawer__link" onClick={closeModals}>
                <Settings className="h-4 w-4" />
                Account settings
              </button>
              <button type="button" className="membership-drawer__link membership-drawer__link--muted" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </footer>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
