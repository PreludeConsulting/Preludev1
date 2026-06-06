import {
  GraduationCap,
  MessageCircle,
  Target,
  ArrowUpRight
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Button } from "./ui/button.jsx";
import PreludeLogo from "./PreludeLogo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getPricingPlans } from "../lib/plans.js";
import PricingCard from "./PricingCard.jsx";
import { startBillingCheckout } from "../lib/auth.js";

const mediaBase = import.meta.env.BASE_URL;
const media = {
  mentorLoop: `${mediaBase}media/mentor-lounge-loop.gif`,
  admissionsSavings: `${mediaBase}media/admissions-savings-piggy.png`,
  parentShowcaseHq: `${mediaBase}media/parent-dashboard-showcase-hq.png`
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
      <section className="lower-landing__section" id="problem">
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
      <section className="lower-landing__section" id="mentorship">
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
      <div className="parent-showcase__inner">
        <Reveal className="parent-showcase__intro">
          <h2 id="parent-showcase-heading" className="parent-showcase__headline">
            {t("sections.benefits.headline")}
          </h2>
        </Reveal>

        <Reveal className="parent-showcase__visual parent-showcase__visual--hq" delay={0.1}>
          <div className="parent-showcase__card parent-showcase__card--hq">
            <img
              src={media.parentShowcaseHq}
              alt={t("sections.benefits.imageAlt")}
              className="parent-showcase__image"
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
  const { isAuthenticated, openSignIn } = useAuth();
  const { t } = useLanguage();
  const [billingNotice, setBillingNotice] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const translatedPlanCards = t("sections.plans.cards");
  const plans = getPricingPlans().map((plan) => {
    const translatedPlan = translatedPlanCards.find(({ id }) => id === plan.id);
    return {
      ...plan,
      ...translatedPlan,
      priceLabel: plan.paid ? t("sections.plans.priceLabels.paid") : t("sections.plans.priceLabels.free")
    };
  });
  async function handlePlanClick(plan) {
    setBillingNotice("");
    if (!plan.paid) {
      if (isAuthenticated) {
        window.location.hash = "dashboard";
      } else {
        setBillingNotice(t("sections.plans.notices.basicFree"));
        openSignIn();
      }
      return;
    }

    if (!isAuthenticated) {
      setBillingNotice(t("sections.plans.notices.signInFirst"));
      openSignIn();
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const result = await startBillingCheckout(plan.id);
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setBillingNotice(t("sections.plans.notices.comingSoon"));
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
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="lower-landing__headline lower-landing__headline--center lower-landing__headline--section">
            {t("sections.plans.headline")}
          </h2>
          <p className="lower-landing__body lower-landing__body--center">
            {t("sections.plans.body")}
          </p>
        </Reveal>
        {billingNotice ? (
          <p className="mx-auto mt-8 max-w-xl rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-center font-body text-sm text-muted-foreground">
            {billingNotice}
          </p>
        ) : null}
        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
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
              href="mailto:hello@preludeconsulting.com"
              className="bg-white text-primary hover:bg-white/95"
            >
              {t("sections.cta.primary")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button href="#pricing" variant="secondary" className="border-white/40 bg-transparent text-white hover:bg-white/10">
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
  const links = [
    { label: t("sections.footer.links.how"), href: "#how-it-works" },
    { label: t("sections.footer.links.mentorship"), href: "#how-it-works" },
    { label: t("sections.footer.links.pricing"), href: "#pricing" },
    { label: t("sections.footer.links.contact"), href: "#contact" }
  ];

  return (
    <footer className="lower-landing lower-landing__footer">
      <div className="lower-landing__footer-inner">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <PreludeLogo className="prelude-logo--footer" />
            <p className="mt-2 max-w-xs font-body text-sm font-light leading-6 text-muted-foreground">
              {t("sections.footer.body")}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label={t("sections.footer.label")}>
            {links.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="font-body text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-foreground/8 pt-6 font-body text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>{t("sections.footer.copyright")}</p>
          <div className="flex gap-6">
            <a href="#contact" className="hover:text-foreground">
              {t("sections.footer.privacy")}
            </a>
            <a href="#contact" className="hover:text-foreground">
              {t("sections.footer.terms")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
