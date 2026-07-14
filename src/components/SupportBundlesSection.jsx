import {
  ArrowRight,
  Check,
  Lock,
  Star
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  buildBundleWalletPath,
  savePendingBundleIntent
} from "../lib/bundlePurchaseIntent.js";
import {
  canAccessDashboard,
  postAuthDestination,
  userNeedsPaymentStep
} from "../lib/onboardingRoutes.js";
import ScrollReveal from "./motion/ScrollReveal.jsx";

function EssayIllustration() {
  return (
    <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <ellipse cx="36" cy="62" rx="20" ry="4" fill="#DDD6FE" opacity="0.7" />
      <rect x="18" y="12" width="30" height="40" rx="5" fill="#EDE9FE" stroke="#6D5EFC" strokeWidth="2" />
      <path d="M25 22h16M25 29h14M25 36h10" stroke="#6D5EFC" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M40 40.5l13-13 4.5 4.5-13 13-5.8 1.3 1.3-5.8z"
        fill="#C4B5FD"
        stroke="#5B4FD6"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M51 30l4.5 4.5" stroke="#5B4FD6" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SessionsIllustration() {
  return (
    <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <ellipse cx="34" cy="62" rx="20" ry="4" fill="#DDD6FE" opacity="0.7" />
      <rect x="16" y="18" width="34" height="32" rx="6" fill="#EDE9FE" stroke="#6D5EFC" strokeWidth="2" />
      <path d="M16 28h34" stroke="#6D5EFC" strokeWidth="2" />
      <path d="M25 14v10M41 14v10" stroke="#6D5EFC" strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="37" r="2.4" fill="#A78BFA" />
      <circle cx="34" cy="37" r="2.4" fill="#A78BFA" />
      <circle cx="42" cy="37" r="2.4" fill="#C4B5FD" />
      <circle cx="26" cy="45" r="2.4" fill="#C4B5FD" />
      <circle cx="48" cy="48" r="12" fill="#F5F3FF" stroke="#5B4FD6" strokeWidth="2.2" />
      <path
        d="M48 41.5V49l5 3"
        stroke="#5B4FD6"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PUBLIC_BUNDLE_CARDS = [
  {
    id: "essay_support",
    title: "Essay Support",
    description: "Guided feedback for personal statements and supplemental essays.",
    Illustration: EssayIllustration,
    options: ["6 essay reviews", "8 essay reviews", "10 essay reviews"],
    summary: "Personal statements, supplemental essays, revisions, and final edits.",
    ctaLabel: "Customize Essay Support",
    note: "Choose your essay reviews before checkout",
    featured: true
  },
  {
    id: "flexible_sessions",
    title: "Flexible Sessions",
    description: "Buy sessions and use them wherever your student needs help.",
    Illustration: SessionsIllustration,
    options: ["2 sessions", "6 sessions", "8 sessions"],
    summary: "Use sessions for admissions, essays, SAT/ACT prep, tutoring, or financial aid.",
    ctaLabel: "Choose Sessions",
    note: "Choose your session amount before checkout",
    featured: false
  }
];

function SupportBundleCard({ card, onCustomize }) {
  const Illustration = card.Illustration;

  return (
    <article
      className={`support-bundle-card${card.featured ? " support-bundle-card--featured" : ""}`}
    >
      {card.featured ? (
        <span className="support-bundle-card__ribbon">
          <Star aria-hidden="true" />
          Best Value
        </span>
      ) : null}

      <div className="support-bundle-card__top">
        <span className="support-bundle-card__pill">One-time Payment</span>
      </div>

      <div className="support-bundle-card__icon" aria-hidden="true">
        <Illustration />
      </div>

      <h3 className="support-bundle-card__title">{card.title}</h3>
      <p className="support-bundle-card__desc">{card.description}</p>

      <div className="support-bundle-card__divider" role="presentation">
        <span>Popular options</span>
      </div>

      <ul className="support-bundle-card__options">
        {card.options.map((option) => (
          <li key={option} className="support-bundle-card__option-row">
            <span className="support-bundle-card__option-check" aria-hidden="true">
              <Check />
            </span>
            <span>{option}</span>
          </li>
        ))}
      </ul>

      <p className="support-bundle-card__summary">
        <Check aria-hidden="true" />
        <span>{card.summary}</span>
      </p>

      <div className="support-bundle-card__footer">
        <button
          type="button"
          className="support-bundle-card__cta"
          onClick={() => onCustomize(card.id)}
        >
          <span>{card.ctaLabel}</span>
          <ArrowRight aria-hidden="true" />
        </button>
        <p className="support-bundle-card__note">
          <Lock aria-hidden="true" />
          {card.note}
        </p>
      </div>
    </article>
  );
}

export default function SupportBundlesSection() {
  const navigate = useNavigate();
  const { user, isAuthenticated, openRegister } = useAuth();

  function handleCustomize(bundleId) {
    savePendingBundleIntent(bundleId);
    const paymentPath = buildBundleWalletPath({ payment: true, bundleId });
    const publicPath = buildBundleWalletPath({ payment: false, bundleId });
    const requiresRealAccount = user?.authProvider === "demo" || user?.authProvider === "dev";

    if (!isAuthenticated || requiresRealAccount) {
      openRegister();
      return;
    }

    if (userNeedsPaymentStep(user)) {
      navigate(paymentPath);
      return;
    }

    if (user?.role === "student" && !canAccessDashboard(user)) {
      navigate(postAuthDestination(user));
      return;
    }

    navigate(publicPath);
  }

  return (
    <section className="support-bundles" id="bundles" data-section-nav="bundles" aria-labelledby="support-bundles-heading">
      <div className="support-bundles__decor" aria-hidden="true">
        <span className="support-bundles__blob support-bundles__blob--tl" />
        <span className="support-bundles__blob support-bundles__blob--tr" />
        <span className="support-bundles__dots support-bundles__dots--bl" />
        <span className="support-bundles__dots support-bundles__dots--br" />
        <span className="support-bundles__spark support-bundles__spark--a" />
        <span className="support-bundles__spark support-bundles__spark--b" />
        <span className="support-bundles__spark support-bundles__spark--c" />
      </div>

      <ScrollReveal className="support-bundles__intro">
        <p className="support-bundles__eyebrow">One-time bundles</p>
        <h2 id="support-bundles-heading" className="support-bundles__title">
          Support on Your Schedule
        </h2>
        <p className="support-bundles__lede">
          Choose essay reviews or flexible sessions with no monthly commitment.
        </p>
        <p className="support-bundles__distinction">
          <Check aria-hidden="true" />
          No monthly subscription
        </p>
      </ScrollReveal>

      <div className="support-bundles__grid">
        {PUBLIC_BUNDLE_CARDS.map((card, index) => (
          <ScrollReveal key={card.id} delay={index * 0.08} className="support-bundles__card-reveal">
            <SupportBundleCard card={card} onCustomize={handleCustomize} />
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
