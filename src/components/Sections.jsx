import {
  FileText,
  GraduationCap,
  MessageCircle,
  Target,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button } from "./ui/button.jsx";
import PreludeLogo from "./PreludeLogo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getPricingPlans } from "../lib/plans.js";
import PricingCard from "./PricingCard.jsx";
import AcademicProgramCard from "./AcademicProgramCard.jsx";
import { startBillingCheckout } from "../lib/auth.js";
import { FOOTER_LINK_COLUMNS } from "../data/footerLinks.js";
import AppLink from "./AppLink.jsx";
import { useLegalModal } from "../context/LegalModalContext.jsx";

const mediaBase = import.meta.env.BASE_URL;
const media = {
  mentorLoop: `${mediaBase}media/mentor-lounge-loop.gif`,
  admissionsSavings: `${mediaBase}media/admissions-savings-piggy.png`,
  parentShowcaseHq: `${mediaBase}media/parent-dashboard-showcase-hq.png`,
  parentShowcaseDuplicate: `${mediaBase}media/parent-dashboard-showcase-duplicate.png`
};

function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function AdmissionsCostBanner() {
  const { t } = useLanguage();

  return (
    <section className="admissions-cost-banner" id="about-cost">
      <div className="admissions-cost-banner__inner">
        <Reveal className="admissions-cost-banner__visual">
          <img
            src={media.admissionsSavings}
            alt={t("sections.cost.imageAlt")}
            className="admissions-cost-banner__image"
          />
        </Reveal>

        <Reveal className="admissions-cost-banner__copy" delay={0.12}>
          <p className="admissions-cost-banner__body max-w-lg text-lg leading-7 text-white md:text-xl md:leading-8">
            {t("sections.cost.bodyBefore")} <span className="admissions-cost-banner__amount">$6,500</span> {t("sections.cost.bodyAfter")}
          </p>
          <h2 className="ivy-display mt-6 max-w-xl text-5xl font-extrabold uppercase leading-[0.88] tracking-[-0.035em] text-white md:text-7xl lg:text-[5.8rem]">
            {t("sections.cost.headline")}
          </h2>
        </Reveal>
      </div>
    </section>
  );
}

export function LowerFeatureIntro() {
  const { t } = useLanguage();

  return (
    <div className="lower-landing">
      <section className="lower-landing__section">
        <Reveal>
          <p className="lower-landing__eyebrow">{t("sections.featureIntro.eyebrow")}</p>
          <h2 className="lower-landing__headline lower-landing__headline--wide">
            {t("sections.featureIntro.headline")}
          </h2>
          <p className="lower-landing__body">
            {t("sections.featureIntro.body")}
          </p>
        </Reveal>
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
          <Reveal>
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
          </Reveal>
          <Reveal className="lower-landing__visual" delay={0.1}>
            <img
              src={media.mentorLoop}
              alt={t("sections.split.imageAlt")}
            />
          </Reveal>
        </div>
      </section>
    </div>
  );
}

export function LowerBenefits() {
  const { t } = useLanguage();

  return (
    <section className="parent-showcase scroll-mt-28" id="how-it-works" aria-labelledby="parent-showcase-heading">
      <span id="roadmap" className="sr-only" aria-hidden="true" />
      <span id="clarity" className="sr-only" aria-hidden="true" />
      <div className="parent-showcase__inner">
        <Reveal className="parent-showcase__intro">
          <h2 id="parent-showcase-heading" className="parent-showcase__headline">
            {t("sections.benefits.headline")}
          </h2>
        </Reveal>

        <Reveal className="parent-showcase__visual" delay={0.1}>
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
        </Reveal>
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
      <section className="lower-landing__section" id="pricing">
        <div className="pricing-section__stack">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="lower-landing__headline lower-landing__headline--center lower-landing__headline--section">
              {t("sections.plans.headline")}
            </h2>
          </Reveal>
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="lower-landing__body lower-landing__body--center">
              {t("sections.plans.body")}
            </p>
          </Reveal>
          {billingNotice ? (
            <p className="pricing-section__notice mx-auto max-w-xl rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-center font-body text-sm text-muted-foreground">
              {billingNotice}
            </p>
          ) : null}
          <div className="pricing-section__cards grid gap-6 lg:grid-cols-3 lg:gap-8">
          {plans.map((plan, index) => (
            <Reveal delay={index * 0.08} key={plan.id}>
              <PricingCard
                plan={plan}
                onSelect={handlePlanClick}
                loading={loadingPlan === plan.id}
                mostPopularLabel={t("sections.plans.mostPopular")}
                startFreeLabel={t("sections.plans.startFree")}
                chooseLabel={t("sections.plans.choose")}
                pleaseWaitLabel={t("sections.plans.pleaseWait")}
              />
            </Reveal>
          ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LowerAcademicPrograms() {
  const { t } = useLanguage();

  return (
    <div className="lower-landing">
      <section
        className="lower-landing__section academic-programs-section scroll-mt-28"
        id="academic-support"
        aria-labelledby="academic-programs-heading"
      >
        <div className="academic-programs-section__divider" role="separator" aria-hidden="true" />

        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="academic-programs-heading" className="academic-programs-section__headline">
            {t("sections.academicPrograms.headline")}
          </h2>
          <p className="academic-programs-section__subheadline">
            {t("sections.academicPrograms.subheadline")}
          </p>
        </Reveal>

        <div className="academic-programs-section__cards mx-auto grid max-w-4xl gap-5 md:grid-cols-2 md:gap-6">
          {t("sections.academicPrograms.cards").map((card, index) => (
            <Reveal delay={index * 0.06} key={card.id}>
              <AcademicProgramCard card={card} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LowerCta() {
  const { t } = useLanguage();

  return (
    <div className="lower-landing">
      <section className="lower-landing__cta" id="contact">
        <Reveal>
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
        </Reveal>
      </section>
    </div>
  );
}

export function LowerFooter() {
  const { t } = useLanguage();
  const { openLegal } = useLegalModal();
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
                      <AppLink href={href} className="lower-landing__footer-link">
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
