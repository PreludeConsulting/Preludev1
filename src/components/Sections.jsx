import {
  FileText,
  GraduationCap,
  MessageCircle,
  Target,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button } from "./ui/button.jsx";
import PreludeLogo from "./PreludeLogo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getPricingPlans } from "../lib/plans.js";
import PricingCard from "./PricingCard.jsx";
import RewardsShowcase from "./RewardsShowcase.jsx";
import { startBillingCheckout } from "../lib/auth.js";
import { FOOTER_LINK_COLUMNS } from "../data/footerLinks.js";
import AppLink from "./AppLink.jsx";
import { useLegalModal } from "../context/LegalModalContext.jsx";
import { dashboardPathForRole } from "../lib/onboardingRoutes.js";
import ScrollReveal from "./motion/ScrollReveal.jsx";
export { default as AdmissionsCostBanner } from "./AdmissionsCostBanner.jsx";

const mediaBase = import.meta.env.BASE_URL;
const media = {
  mentorLoop: `${mediaBase}media/mentor-lounge-loop.gif`,
  parentShowcaseHq: `${mediaBase}media/parent-dashboard-showcase-hq.png`,
  parentShowcaseDuplicate: `${mediaBase}media/parent-dashboard-showcase-duplicate.png`
};

export function LowerFeatureIntro() {
  const { t } = useLanguage();

  return (
    <div className="lower-landing">
      <section className="lower-landing__section">
        <ScrollReveal>
          <p className="lower-landing__eyebrow">{t("sections.featureIntro.eyebrow")}</p>
          <h2 className="lower-landing__headline lower-landing__headline--wide">
            {t("sections.featureIntro.headline")}
          </h2>
          <p className="lower-landing__body">
            {t("sections.featureIntro.body")}
          </p>
        </ScrollReveal>
      </section>
    </div>
  );
}

export function LowerSplitVisual() {
  const { t } = useLanguage();
  const bullets = t("sections.split.bullets");

  return (
    <div className="lower-landing">
      <section className="lower-landing__section">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <ScrollReveal>
            <p className="lower-landing__eyebrow">{t("sections.split.eyebrow")}</p>
            <h2 className="lower-landing__headline">
              {t("sections.split.headline")}
            </h2>
            <p className="lower-landing__body">
              {t("sections.split.body")}
            </p>
            <ul className="mt-8 grid gap-3 font-body text-sm font-light text-muted-foreground">
              <li className="flex gap-3">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {bullets[0]}
              </li>
              <li className="flex gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {bullets[1]}
              </li>
              <li className="flex gap-3">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {bullets[2]}
              </li>
            </ul>
          </ScrollReveal>
          <ScrollReveal className="lower-landing__visual" delay={0.1}>
            <img
              src={media.mentorLoop}
              alt={t("sections.split.imageAlt")}
            />
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function LowerBenefits() {
  const { t } = useLanguage();

  return (
    <section className="parent-showcase scroll-mt-28" id="how-it-works" data-section-nav="how-it-works" aria-labelledby="parent-showcase-heading">
      <span id="roadmap" className="sr-only" aria-hidden="true" />
      <span id="clarity" className="sr-only" aria-hidden="true" />
      <div className="parent-showcase__inner">
        <ScrollReveal className="parent-showcase__intro">
          <h2 id="parent-showcase-heading" className="parent-showcase__headline">
            {t("sections.benefits.headline")}
          </h2>
        </ScrollReveal>

        <ScrollReveal className="parent-showcase__visual" delay={0.08}>
          <div className="parent-showcase__card parent-showcase__card--hq">
            <img
              src={media.parentShowcaseDuplicate}
              srcSet={`${media.parentShowcaseHq} 1024w, ${media.parentShowcaseDuplicate} 2048w`}
              sizes="(min-width: 896px) 896px, 100vw"
              alt={t("sections.benefits.imageAlt")}
              className="parent-showcase__image parent-showcase__image--enhanced"
              loading="lazy"
              decoding="async"
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function LowerPlans() {
  const { user, isAuthenticated, openRegister } = useAuth();
  const { t } = useLanguage();
  const [billingNotice, setBillingNotice] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const allowGuestCheckout = import.meta.env.DEV || import.meta.env.VITE_ALLOW_GUEST_CHECKOUT === "true";
  const translatedPlanCards = t("sections.plans.cards");
  const plans = getPricingPlans().map((plan) => {
    const translatedPlan = translatedPlanCards.find(({ id }) => id === plan.id);
    return {
      ...plan,
      ...translatedPlan,
      // Keep canonical session/review callouts from plans.js (not i18n-overwritten away).
      flexibleSessionCallout: plan.flexibleSessionCallout,
      flexibleSessionDetail: plan.flexibleSessionDetail,
      calloutKind: plan.calloutKind,
      priceAmount: plan.price || null,
      pricePeriod: plan.price ? t("sections.plans.priceLabels.perMonth") : null,
      priceLabel: plan.price
        ? null
        : plan.paid
          ? t("sections.plans.priceLabels.paid")
          : t("sections.plans.priceLabels.free")
    };
  });
  async function handlePlanClick(plan) {
    setBillingNotice("");
    const requiresRealAccount = user?.authProvider === "demo" || user?.authProvider === "dev";
    if (!plan.paid) {
      if (isAuthenticated && !requiresRealAccount) {
        window.location.hash = "dashboard";
      } else {
        setBillingNotice(t("sections.plans.notices.basicFree"));
        openRegister();
      }
      return;
    }

    if ((!isAuthenticated || requiresRealAccount) && !allowGuestCheckout) {
      setBillingNotice(t("sections.plans.notices.signInFirst"));
      openRegister();
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const result = await startBillingCheckout(plan.id, { guestCheckout: !isAuthenticated || requiresRealAccount });
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setBillingNotice(t("sections.plans.notices.comingSoon"));
      } else if (error.status === 401 || error.status === 403) {
        setBillingNotice(t("sections.plans.notices.signInFirst"));
        openRegister();
      } else {
        setBillingNotice(error.message || t("sections.plans.notices.unavailable"));
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="lower-landing">
      <section className="lower-landing__section" id="pricing" data-section-nav="pricing">
        <div className="pricing-section__stack">
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <h2 className="lower-landing__headline lower-landing__headline--center lower-landing__headline--section">
              {t("sections.plans.headline")}
            </h2>
          </ScrollReveal>
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <p className="lower-landing__body lower-landing__body--center">
              {Array.isArray(t("sections.plans.bodyServices")) ? (
                <>
                  {t("sections.plans.bodyBefore")}
                  {t("sections.plans.bodyServices").map((service, index, list) => (
                    <span key={service}>
                      <span className="pricing-section__service-highlight">{service}</span>
                      {index < list.length - 1 ? ", " : null}
                    </span>
                  ))}
                  {t("sections.plans.bodyAfter")}
                </>
              ) : (
                t("sections.plans.body")
              )}
            </p>
          </ScrollReveal>
          {billingNotice ? (
            <p className="pricing-section__notice mx-auto max-w-xl rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-center font-body text-sm text-muted-foreground">
              {billingNotice}
            </p>
          ) : null}
          <div className="pricing-section__cards grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
          {plans.map((plan, index) => (
            <ScrollReveal delay={index * 0.08} key={plan.id} className="pricing-section__card-reveal">
              <PricingCard
                plan={plan}
                onSelect={handlePlanClick}
                loading={loadingPlan === plan.id}
                mostPopularLabel={t("sections.plans.mostPopular")}
                startFreeLabel={t("sections.plans.startFree")}
                chooseLabel={t("sections.plans.choose")}
                pleaseWaitLabel={t("sections.plans.pleaseWait")}
              />
            </ScrollReveal>
          ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LowerAcademicPrograms() {
  return (
    <div className="lower-landing">
      <RewardsShowcase />
    </div>
  );
}

export function LowerCta() {
  const { t } = useLanguage();

  return (
    <div className="lower-landing">
      <section className="lower-landing__cta" id="contact" data-section-nav="contact" data-aura-zone>
        <ScrollReveal>
          <h2 className="lower-landing__headline lower-landing__headline--center">
            {t("sections.cta.headline")}
          </h2>
          <p className="lower-landing__body">
            {t("sections.cta.body")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              as={Link}
              to="/contact"
              className="bg-white text-primary hover:bg-white/95"
            >
              {t("sections.cta.primary")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button as={Link} to="/contact#email-us" variant="secondary" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              {t("sections.cta.secondary")}
            </Button>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}

export function LowerFooter() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { openLegal } = useLegalModal();
  const isParent = String(user?.role || "").toLowerCase() === "parent";
  const parentDashboardHref = isParent ? dashboardPathForRole(user.role) : "/register";
  const followLinks = [
    { label: "Instagram", href: "https://www.instagram.com/preludellc/" },
    { label: "X", href: "https://x.com/PreludeLLC" },
    { label: "Youtube", href: "https://www.youtube.com/@PreludeLLC" },
    { label: "Email", href: "mailto:preludesupport@preludeconsultingllc.com" },
    { label: "LinkedIn", href: "https://linkedin.com/" }
  ];

  return (
    <footer className="lower-landing lower-landing__footer">
      <div className="lower-landing__footer-inner">
        <div className="lower-landing__footer-top">
          <div className="lower-landing__footer-brand">
            <PreludeLogo className="prelude-logo--footer" />
            <p className="lower-landing__footer-tagline">
              {t("sections.footer.body")}
            </p>
          </div>
          <div className="lower-landing__footer-link-groups">
            {FOOTER_LINK_COLUMNS.map((column) => (
              <nav
                key={column.headingKey}
                className="lower-landing__footer-link-group"
                aria-label={t(column.ariaLabelKey)}
              >
                <h2 className="lower-landing__footer-heading">{t(column.headingKey)}</h2>
                <ul className="lower-landing__footer-links">
                  {column.links.map(({ labelKey, href }) => (
                    <li key={`${column.headingKey}-${labelKey}`}>
                      <AppLink
                        href={
                          labelKey === "sections.footer.links.parentDashboard"
                            ? parentDashboardHref
                            : href
                        }
                        className="lower-landing__footer-link"
                        onClick={() => {
                          if (labelKey === "sections.footer.links.bookCall") {
                            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                          }
                        }}
                      >
                        {t(labelKey)}
                      </AppLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <section className="lower-landing__footer-link-group" aria-labelledby="footer-follow-heading">
              <h2 id="footer-follow-heading" className="lower-landing__footer-heading">
                {t("sections.footer.follow")}
              </h2>
              <ul className="lower-landing__footer-links">
                {followLinks.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target={href.startsWith("mailto:") ? undefined : "_blank"}
                      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                      className="lower-landing__footer-link"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        <div className="lower-landing__footer-bottom">
          <p>{t("sections.footer.copyright")}</p>
          <div className="lower-landing__footer-legal">
            <button
              type="button"
              className="lower-landing__footer-legal-link lower-landing__footer-legal-link--privacy"
              onClick={() => openLegal("privacy")}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {t("sections.footer.privacy")}
            </button>
            <button
              type="button"
              className="lower-landing__footer-legal-link lower-landing__footer-legal-link--terms"
              onClick={() => openLegal("terms")}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t("sections.footer.terms")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
