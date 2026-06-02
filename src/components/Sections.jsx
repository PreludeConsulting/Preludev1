import {
  BookOpen,
  CalendarCheck,
  CheckCircle,
  Compass,
  DollarSign,
  GraduationCap,
  Map,
  MessageCircle,
  Sparkles,
  Target,
  Trophy,
  Users,
  ArrowUpRight
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Button } from "./ui/button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { startBillingCheckout } from "../lib/auth.js";
import RoadmapPath from "./RoadmapPath.jsx";

const mediaBase = import.meta.env.BASE_URL;
const media = {
  mentorLoop: `${mediaBase}media/mentor-lounge-loop.gif`,
  roadmapImage: `${mediaBase}media/roadmap-dashboard.png`,
  roadmapLoop: `${mediaBase}media/roadmap-dashboard-loop.gif`,
  impactLoop: `${mediaBase}media/impact-desk-loop.gif`
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

function SectionIntro({ badge, heading, body, centered = false }) {
  return (
    <div className={centered ? "mx-auto mb-10 max-w-3xl text-center md:mb-12" : "mb-10 max-w-3xl md:mb-12"}>
      <div className="section-badge mb-5">{badge}</div>
      <h2 className="section-heading">{heading}</h2>
      {body ? <p className="body-copy mt-6">{body}</p> : null}
    </div>
  );
}

function IconCard({ icon: Icon, title, text, featured = false }) {
  return (
    <Reveal className={`paper-card rounded-2xl p-6 ${featured ? "paper-card-featured" : ""}`}>
      <Icon className="mb-8 h-6 w-6 text-primary" aria-hidden="true" />
      <h3 className="subheading text-3xl">{title}</h3>
      <p className="mt-4 font-body text-sm font-light leading-7 text-muted-foreground">{text}</p>
    </Reveal>
  );
}

export function AdmissionsCostBanner() {
  return (
    <section className="admissions-cost-banner" id="about-cost">
      <div className="admissions-cost-banner__inner">
        <Reveal className="admissions-cost-banner__visual">
          <div className="admissions-cost-banner__card" aria-hidden="true">
            <span className="admissions-cost-banner__eyebrow">Here lies</span>
            <span className="admissions-cost-banner__price">$6,500</span>
            <span className="admissions-cost-banner__caption">in avoidable consulting spend</span>
          </div>
          <div className="admissions-cost-banner__ring" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </Reveal>

        <Reveal className="admissions-cost-banner__copy" delay={0.12}>
          <p className="font-serif text-lg font-semibold leading-7 text-white md:text-xl">
            American families spend over $6,500 on college admissions consulting every year.
          </p>
          <h2 className="ivy-display mt-6 max-w-xl text-6xl font-extrabold uppercase leading-[0.86] tracking-[-0.035em] text-white md:text-8xl lg:text-[7.5rem]">
            Spend smarter, not more.
          </h2>
        </Reveal>
      </div>
    </section>
  );
}

export function ProblemSolution() {
  return (
    <section className="section-shell grid gap-6 lg:grid-cols-2" id="problem">
      <Reveal className="paper-card rounded-[2rem] p-8 md:p-10">
        <div className="section-badge mb-6">The Problem</div>
        <h2 className="section-heading">College admissions feels harder than it should.</h2>
        <p className="body-copy mt-7">
          Traditional consulting is expensive, outdated, and often disconnected from what students actually experience
          today. Families spend time and money on generic advice, while students struggle to turn their real identity
          into a compelling application story.
        </p>
      </Reveal>
      <Reveal className="paper-card rounded-[2rem] p-8 md:p-10" delay={0.12}>
        <div className="section-badge mb-6">The Prelude Approach</div>
        <h2 className="section-heading">Current students. Real guidance. A clearer path.</h2>
        <p className="body-copy mt-7">
          Prelude matches students with mentors who attend the colleges they aspire to join. Instead of only focusing on
          SAT scores or GPA, we help students build a distinct personal narrative, strengthen essays, organize deadlines,
          and understand the financial side of college.
        </p>
      </Reveal>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ["01", "Match", "Get paired with current college students from your target schools or similar academic paths."],
    ["02", "Build", "Develop your identity, essays, activities, and application strategy with guided support."],
    ["03", "Apply", "Track deadlines, prepare interviews, compare costs, and submit with confidence."]
  ];

  return (
    <section className="section-shell" id="how-it-works">
      <SectionIntro
        badge="How It Works"
        heading="You dream it. We map it."
        body="Tell us your goals, target schools, interests, and background. Prelude matches you with the right mentor, builds your personalized roadmap, and helps you move milestone by milestone toward stronger applications."
      />
      <div className="relative mx-auto max-w-4xl">
        <div className="absolute bottom-10 left-6 top-10 hidden w-px bg-foreground/12 md:block" aria-hidden="true" />
        <div className="grid gap-5">
          {steps.map(([number, title, text], index) => (
            <Reveal className="paper-card rounded-2xl p-6 md:ml-12 md:grid md:grid-cols-[120px_1fr] md:p-8" delay={index * 0.12} key={title}>
              <div className="subheading mb-6 text-5xl text-accent md:mb-0">{number}</div>
              <div>
                <h3 className="subheading text-4xl">{title}</h3>
                <p className="body-copy mt-4">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MentorMatching() {
  const cards = [
    [GraduationCap, "Target schools", "Current college students from the universities applicants care about most."],
    [Users, "Shared context", "Matching by major, interests, activities, and personal application goals."],
    [MessageCircle, "Direct access", "Messaging creates steady momentum between scheduled Zoom sessions."],
    [Target, "Parent clarity", "Progress updates help families see what is happening and what comes next."]
  ];

  return (
    <section className="section-shell" id="mentorship">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <SectionIntro
            badge="PreludeMatch"
            heading="Meet mentors who have already reached where you want to go."
            body="PreludeMatch helps students find mentors based on school, intended major, extracurricular background, and application goals. A student interested in engineering, music, medicine, business, marching band, research, or community service can connect with someone who understands that path."
          />
          <Reveal className="paper-card rounded-[2rem] p-3">
            <div className="media-frame h-72 rounded-[1.5rem]">
              <img
                src={media.mentorLoop}
                alt="Animated mentorship scene for PreludeMatch"
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(([Icon, title, text], index) => (
            <IconCard icon={Icon} title={title} text={text} key={title} featured={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturesGrid() {
  const features = [
    {
      Icon: GraduationCap,
      title: "Peer Mentorship",
      text: "Students learn from current college students who understand the admissions process, campus life, and what it takes to stand out.",
      image: media.mentorLoop,
      className: "lg:col-span-7 lg:row-span-2"
    },
    {
      Icon: Sparkles,
      title: "Identity Building",
      text: "We help students turn their background, interests, and experiences into a clear personal narrative.",
      image: media.roadmapLoop,
      className: "lg:col-span-5"
    },
    {
      Icon: DollarSign,
      title: "Financial Guidance",
      text: "Families receive support with scholarships, FAFSA, CSS Profile, aid strategy, and true cost comparison.",
      image: media.impactLoop,
      className: "lg:col-span-5"
    },
    {
      Icon: Trophy,
      title: "Gamified Progress",
      text: "Roadmaps, milestones, and progress tracking make the application process more motivating and less overwhelming.",
      image: media.roadmapImage,
      className: "lg:col-span-12"
    }
  ];

  return (
    <section className="section-shell feature-showcase-section">
      <SectionIntro badge="Why Prelude" heading="The difference is personal." centered />
      <div className="feature-showcase-grid grid gap-5 lg:grid-cols-12 lg:auto-rows-[18rem]">
        {features.map(({ Icon, title, text, image, className }, index) => (
          <Reveal className={`feature-showcase-card group ${className}`} delay={index * 0.12} key={title}>
            <img
              src={image}
              alt={`${title} visual`}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045] group-hover:brightness-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/62 via-foreground/12 to-background/5" aria-hidden="true" />
            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1.5 font-body text-xs font-medium text-primary-foreground backdrop-blur-md md:left-6 md:top-6">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              Prelude
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5 text-primary-foreground md:p-7">
              <h3 className="subheading text-4xl md:text-5xl">{title}</h3>
              <p className="mt-3 max-w-xl font-body text-sm font-light leading-6 text-primary-foreground/80 md:text-base">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Plans() {
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
    <section className="section-shell" id="pricing">
      <SectionIntro badge="Plans" heading="Support that grows with your goals." centered />
      {billingNotice ? (
        <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4 text-center font-body text-sm text-foreground/80">
          {billingNotice}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <Reveal
            className={`paper-card flex rounded-[2rem] p-7 md:p-8 ${plan.emphasized ? "paper-card-featured" : ""}`}
            delay={index * 0.12}
            key={plan.name}
          >
            <div className="flex min-h-full w-full flex-col">
              {plan.emphasized ? (
                <span className="mb-3 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 font-body text-xs font-medium text-primary">
                  Most popular
                </span>
              ) : null}
              <h3 className="subheading text-5xl text-foreground">{plan.name}</h3>
              <p className="mt-4 font-body text-sm font-light leading-7 text-muted-foreground">{plan.description}</p>
              <ul className="mt-8 grid gap-3">
                {plan.features.map((feature) => (
                  <li className="flex gap-3 font-body text-sm font-light leading-6 text-foreground/76" key={feature}>
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button as="button" type="button" variant="primary" className="mt-8 w-full" onClick={() => handlePlanClick(plan)} disabled={loadingPlan === plan.id}>
                {loadingPlan === plan.id ? "Please wait..." : plan.paid ? `Choose ${plan.name}` : "Start free"}
              </Button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function GamifiedRoadmap() {
  return (
    <section className="section-shell" id="roadmap">
      <SectionIntro
        badge="Roadmap"
        heading="Turn applications into a path students actually want to follow."
        body="Follow a clear, step-by-step path through college applications. Sign in and chat with Prelude AI to unlock progress on your personal dashboard."
        centered
      />
      <Reveal className="paper-card mx-auto max-w-md rounded-[2rem] p-6 md:p-8">
        <RoadmapPath previewMode sectionBanner="Sign in to save your progress · Demo path below" />
        <div className="mt-6 text-center">
          <a href="#dashboard" className="prelude-btn-primary inline-flex items-center justify-center px-6 py-3 font-body text-sm font-medium no-underline">
            Open your dashboard
          </a>
        </div>
      </Reveal>
    </section>
  );
}

function DashboardMotionPanel() {
  return (
    <div className="dashboard-video rounded-[1.5rem]" aria-hidden="true">
      <div className="dashboard-video__scan" />
      <div className="dashboard-video__column">
        <span />
        <span />
        <span />
      </div>
      <div className="dashboard-video__path">
        {[0, 1, 2, 3].map((item) => (
          <i key={item} />
        ))}
      </div>
    </div>
  );
}

export function AIDashboard() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-10% 0px -10% 0px" });
  const [mediaStatus, setMediaStatus] = useState("future media support loading");
  const bullets = [
    "Central application dashboard",
    "Deadline tracking",
    "Essay prompt organization",
    "Profile analyzer",
    "Strength and opportunity suggestions",
    "Scholarship and financial aid reminders"
  ];

  useEffect(() => {
    if (!inView) {
      return;
    }

    import("hls.js").then(({ default: Hls }) => {
      setMediaStatus(Hls.isSupported() ? "adaptive playback supported" : "standard playback fallback");
    });
  }, [inView]);

  return (
    <section className="section-shell" ref={sectionRef}>
      <div className="grid gap-8 lg:grid-cols-[0.82fr_1fr] lg:items-center">
        <SectionIntro
          badge="AI Support"
          heading="AI keeps the process organized. Mentors keep it human."
          body="Prelude AI helps students organize deadlines, essay prompts, scholarships, and application tasks in one central dashboard. The goal is not to replace mentors, but to make the process easier to navigate — with human support when they need to go deeper."
        />
        <Reveal className="paper-card rounded-[2rem] p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1fr]">
            <div className="media-frame min-h-64 rounded-[1.5rem]">
              <img
                src={media.roadmapImage}
                alt="Prelude application dashboard visual"
                className="h-full w-full object-cover"
              />
            </div>
            <DashboardMotionPanel />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bullets.map((bullet, index) => (
              <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background/50 p-4" key={bullet}>
                <span className="subheading text-2xl text-accent">{String(index + 1).padStart(2, "0")}</span>
                <span className="font-body text-sm text-foreground/76">{bullet}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 font-body text-xs text-muted-foreground">
            Future media support ready: {mediaStatus}.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function Stats() {
  const stats = [
    ["1:1", "Mentor matching"],
    ["24/7", "Roadmap visibility"],
    ["3 Plans", "Flexible support"],
    ["100% Remote", "No driving required"]
  ];

  return (
    <section className="section-shell">
      <div className="paper-card grid rounded-[2rem] p-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([number, label], index) => (
          <Reveal className="border-foreground/10 p-6 lg:border-r last:border-r-0" delay={index * 0.1} key={label}>
            <div className="display-heading text-4xl md:text-5xl lg:text-6xl">{number}</div>
            <div className="mt-4 font-body text-sm font-light text-muted-foreground">{label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Testimonials() {
  const cards = [
    ["Parent Value", "Save time without sacrificing quality.", "Remote mentorship removes the need to drive to tutoring centers while giving students access to a broader college network."],
    ["Student Value", "Talk to someone who actually gets it.", "Students receive guidance from mentors who recently went through the same process and understand the pressure."],
    ["Application Value", "Build more than a resume.", "Prelude helps students shape a personal story, not just a list of grades, scores, and activities."]
  ];

  return (
    <section className="section-shell">
      <SectionIntro badge="Built For Families" heading="Guidance students trust. Clarity parents can see." centered />
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map(([label, title, text], index) => (
          <Reveal className="paper-card rounded-2xl p-7" delay={index * 0.12} key={title}>
            <div className="mb-8 font-body text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <h3 className="subheading text-3xl">{title}</h3>
            <p className="body-copy mt-5">{text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function SocialImpact() {
  return (
    <section className="section-shell">
      <Reveal className="paper-card rounded-[2rem] p-8 md:p-12">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1fr] lg:items-end">
          <div>
            <div className="section-badge mb-6">Impact</div>
            <h2 className="section-heading">Built with a bigger purpose.</h2>
          </div>
          <div>
            <p className="body-copy">
              During Prelude's early growth phase, a portion of revenue will support educational charities and causes.
              Families are not only investing in their student's future - they are helping expand access to opportunity.
            </p>
            <div className="media-frame mt-8 h-72 rounded-[1.5rem] border border-primary/15">
              <img
                src={media.impactLoop}
                alt="Animated education access and scholarship planning desk scene"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function CtaFooter() {
  return (
    <footer className="section-shell pb-10" id="contact">
      <div className="paper-card rounded-[2rem] p-8 text-center md:p-12">
        <h2 className="section-heading">Start your Prelude.</h2>
        <p className="body-copy mx-auto mt-6 max-w-2xl">
          Book a free strategy call and begin the admissions process with clarity, confidence, and purpose.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href="mailto:hello@preludeconsulting.com">
            Book a Free Call
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button href="#pricing" variant="secondary">
            View Plans
          </Button>
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-4 border-t border-foreground/10 pt-6 font-body text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>&copy; 2026 Prelude. All rights reserved.</p>
        <div className="flex gap-5">
          <a href="#contact" className="hover:text-foreground">Privacy</a>
          <a href="#contact" className="hover:text-foreground">Terms</a>
          <a href="#contact" className="hover:text-foreground">Contact</a>
        </div>
      </div>
    </footer>
  );
}
