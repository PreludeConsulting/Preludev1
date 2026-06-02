import {
  CheckCircle,
  DollarSign,
  GraduationCap,
  MessageCircle,
  Sparkles,
  Target,
  Users,
  ArrowUpRight
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "./ui/button.jsx";
import PreludeLogo from "./PreludeLogo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { startBillingCheckout } from "../lib/auth.js";

const mediaBase = import.meta.env.BASE_URL;
const media = {
  mentorLoop: `${mediaBase}media/mentor-lounge-loop.gif`,
  admissionsSavings: `${mediaBase}media/admissions-savings-piggy.png`
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
  return (
    <section className="admissions-cost-banner" id="about-cost">
      <div className="admissions-cost-banner__inner">
        <Reveal className="admissions-cost-banner__visual">
          <img
            src={media.admissionsSavings}
            alt="Piggy bank wearing a graduation cap with a 6,500 plus cost callout"
            className="admissions-cost-banner__image"
          />
        </Reveal>

        <Reveal className="admissions-cost-banner__copy" delay={0.12}>
          <p className="max-w-lg font-serif text-lg leading-7 text-white md:text-xl md:leading-8">
            American families spend over <span className="admissions-cost-banner__amount">$6,500</span> on college
            admissions consulting every year.
          </p>
          <h2 className="ivy-display mt-6 max-w-xl text-5xl font-extrabold uppercase leading-[0.88] tracking-[-0.035em] text-white md:text-7xl lg:text-[5.8rem]">
            Spend smarter, not more.
          </h2>
        </Reveal>
      </div>
    </section>
  );
}

export function LowerFeatureIntro() {
  return (
    <div className="lower-landing">
      <section className="lower-landing__section" id="problem">
        <Reveal>
          <p className="lower-landing__eyebrow">The Prelude approach</p>
          <h2 className="lower-landing__headline lower-landing__headline--wide">
            Affordable admissions support that feels personal, not generic.
          </h2>
          <p className="lower-landing__body">
            Traditional consulting is expensive and often disconnected from what students actually experience today.
            Prelude pairs you with near-peer mentors, practical financial guidance, and tools that keep the process
            organized — so families invest in clarity, not clutter.
          </p>
        </Reveal>
      </section>
    </div>
  );
}

export function LowerSplitVisual() {
  return (
    <div className="lower-landing">
      <section className="lower-landing__section" id="mentorship">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="lower-landing__eyebrow">PreludeMatch</p>
            <h2 className="lower-landing__headline">
              Meet mentors who have already reached where you want to go.
            </h2>
            <p className="lower-landing__body">
              Match by target school, major, activities, and goals. Students get guidance from someone who recently
              navigated the same path — with messaging between sessions and updates parents can follow.
            </p>
            <ul className="mt-8 grid gap-3 font-body text-sm font-light text-muted-foreground">
              <li className="flex gap-3">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Current students from your target schools
              </li>
              <li className="flex gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Steady momentum between Zoom sessions
              </li>
              <li className="flex gap-3">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Clear progress families can see
              </li>
            </ul>
          </Reveal>
          <Reveal className="lower-landing__visual" delay={0.1}>
            <img
              src={media.mentorLoop}
              alt="PreludeMatch mentorship preview"
            />
          </Reveal>
        </div>
      </section>
    </div>
  );
}

export function LowerBenefits() {
  const benefits = [
    {
      Icon: Users,
      title: "Guidance students trust",
      text: "Talk to mentors who recently went through admissions and understand the pressure — not outdated playbooks."
    },
    {
      Icon: DollarSign,
      title: "Smarter spending",
      text: "Scholarship strategy, aid comparisons, and financial planning so families know where every dollar goes."
    },
    {
      Icon: Sparkles,
      title: "A story, not just a resume",
      text: "Build identity, essays, and activities into a compelling narrative — with AI organizing deadlines along the way."
    }
  ];

  return (
    <div className="lower-landing">
      <section className="lower-landing__section scroll-mt-28" id="how-it-works">
        <span id="roadmap" className="sr-only" aria-hidden="true" />
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="lower-landing__eyebrow">Why families choose Prelude</p>
          <h2 className="lower-landing__headline lower-landing__headline--center">
            Clarity for students. Confidence for parents.
          </h2>
          <p className="lower-landing__body lower-landing__body--center">
            You dream it. We map it — match, build, and apply with a roadmap that keeps everyone aligned.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
          {benefits.map(({ Icon, title, text }, index) => (
            <Reveal className="lower-landing__benefit" delay={index * 0.08} key={title}>
              <span className="lower-landing__benefit-icon">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="lower-landing__benefit-title">{title}</h3>
              <p className="lower-landing__benefit-text">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LowerPlans() {
  const { isAuthenticated, openSignIn } = useAuth();
  const [billingNotice, setBillingNotice] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const plans = [
    {
      id: "basic",
      name: "Basic",
      description: "Foundational guidance for students beginning their college journey.",
      paid: false,
      features: [
        "Monthly group mentorship session",
        "Access to a matched mentor through PreludeMatch",
        "Limited direct messaging",
        "Personalized college roadmap",
        "Progress tracking",
        "General essay brainstorming support",
        "Financial aid and scholarship resources",
        "General consultant support"
      ]
    },
    {
      id: "plus",
      name: "Plus",
      description: "More personalized guidance and consistent support.",
      paid: true,
      features: [
        "Everything in Basic",
        "Two 1-on-1 mentor sessions per month",
        "Additional monthly group strategy session",
        "Expanded direct messaging",
        "Customized college and application roadmap",
        "Identity-building coaching",
        "Essay feedback and revision support",
        "Peer benchmarking insights"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      description: "End-to-end support for students aiming for top-tier outcomes.",
      paid: true,
      features: [
        "Everything in Plus",
        "Weekly or biweekly 1-on-1 mentor sessions",
        "Priority mentor matching",
        "Priority direct messaging",
        "Comprehensive essay editing",
        "Full application review",
        "Interview preparation",
        "School-specific admissions strategy",
        "Advanced financial consulting",
        "Parent strategy sessions",
        "Premium gamified progress tracking"
      ],
      emphasized: true
    }
  ];

  async function handlePlanClick(plan) {
    setBillingNotice("");
    if (!plan.paid) {
      if (isAuthenticated) {
        window.location.hash = "dashboard";
      } else {
        setBillingNotice("Basic is free. Create an account to start, then upgrade when paid subscriptions are available.");
        openSignIn();
      }
      return;
    }

    if (!isAuthenticated) {
      setBillingNotice("Create or sign into a free Basic account first. Paid subscriptions will attach to that account when Stripe is connected.");
      openSignIn();
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const result = await startBillingCheckout(plan.id);
      if (result.url) window.location.href = result.url;
    } catch (error) {
      if (error.payload?.error === "billing_not_configured") {
        setBillingNotice("Paid subscriptions are coming soon. Basic is free today, and Plus/Pro checkout will turn on after Stripe is connected.");
      } else {
        setBillingNotice(error.message || "Billing is not available right now.");
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="lower-landing">
      <section className="lower-landing__section !pt-0" id="pricing">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="lower-landing__eyebrow">Plans</p>
          <h2 className="lower-landing__headline lower-landing__headline--center">
            Support that grows with your goals.
          </h2>
          <p className="lower-landing__body lower-landing__body--center">
            Start free with Basic. Upgrade when you need more sessions, essay support, and financial strategy.
          </p>
        </Reveal>
        {billingNotice ? (
          <p className="mx-auto mt-8 max-w-xl rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-center font-body text-sm text-muted-foreground">
            {billingNotice}
          </p>
        ) : null}
        <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {plans.map((plan, index) => (
            <Reveal
              className={`lower-landing__plan ${plan.emphasized ? "lower-landing__plan--featured" : ""}`}
              delay={index * 0.08}
              key={plan.name}
            >
              {plan.emphasized ? (
                <span className="mb-4 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 font-body text-xs font-medium text-primary">
                  Most popular
                </span>
              ) : (
                <span className="mb-4 block h-6" aria-hidden="true" />
              )}
              <h3 className="font-body text-2xl font-semibold tracking-tight text-foreground">{plan.name}</h3>
              <p className="mt-3 font-body text-sm font-light leading-6 text-muted-foreground">{plan.description}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {plan.features.slice(0, 5).map((feature) => (
                  <li className="flex gap-2.5 font-body text-sm font-light leading-6 text-foreground/80" key={feature}>
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                as="button"
                type="button"
                variant="primary"
                className="mt-8 w-full"
                onClick={() => handlePlanClick(plan)}
                disabled={loadingPlan === plan.id}
              >
                {loadingPlan === plan.id ? "Please wait..." : plan.paid ? `Choose ${plan.name}` : "Start free"}
              </Button>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LowerCta() {
  return (
    <div className="lower-landing">
      <section className="lower-landing__cta" id="contact">
        <Reveal>
          <h2 className="lower-landing__headline lower-landing__headline--center">
            Start your Prelude.
          </h2>
          <p className="lower-landing__body">
            Book a free strategy call and begin admissions with clarity, confidence, and support that respects your
            budget.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              href="mailto:hello@preludeconsulting.com"
              className="bg-white text-primary hover:bg-white/95"
            >
              Book a free call
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button href="#pricing" variant="secondary" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              View plans
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

export function LowerFooter() {
  const links = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Mentorship", href: "#mentorship" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" }
  ];

  return (
    <footer className="lower-landing lower-landing__footer">
      <div className="lower-landing__footer-inner">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <PreludeLogo className="prelude-logo--footer" />
            <p className="mt-2 max-w-xs font-body text-sm font-light leading-6 text-muted-foreground">
              Peer-powered college admissions counseling — smarter spending, real mentors, affordable support.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
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
          <p>&copy; 2026 Prelude. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#contact" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#contact" className="hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
