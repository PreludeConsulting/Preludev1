import { useLanguage } from "../../context/LanguageContext.jsx";
import PreludeLogo from "../PreludeLogo.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";
import { motion } from "motion/react";

const introContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.12
    }
  }
};

const introItem = {
  hidden: { opacity: 0, y: 14, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.52, ease: [0.2, 0, 0, 1] }
  }
};

const walkthroughSteps = [
  {
    label: "Profile",
    text: "Grade, goals, target schools"
  },
  {
    label: "Roadmap",
    text: "College list and deadlines"
  },
  {
    label: "Essays",
    text: "Mentor feedback and revisions"
  },
  {
    label: "Aid",
    text: "Scholarships and cost strategy"
  },
  {
    label: "Sync",
    text: "Progress returns to Prelude"
  }
];

export default function PreludeMatchIntro({ onStart, reducedMotion }) {
  const { t } = useLanguage();

  if (reducedMotion) {
    return (
      <div className="pm-intro pm-intro--reduced">
        <div className="pm-intro__header">
          <PreludePigAvatar variant="intro" animate={false} label="Prelude mascot" />
          <p className="pm-intro__brand">{t("match.intro.eyebrow")}</p>
        </div>

        <h2 className="pm-intro__title">{t("match.intro.title")}</h2>
        <p className="pm-intro__body">{t("match.intro.body")}</p>

        <div className="pm-intro__reduced-flow" aria-label="PreludeMatch walkthrough summary">
          {walkthroughSteps.map((step) => (
            <p key={step.label}>
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </p>
          ))}
        </div>

        <button type="button" className="pm-btn pm-btn--primary pm-btn--lg pm-intro__cta" onClick={onStart}>
          {t("match.intro.cta")}
        </button>

        <p className="pm-intro__footnote">{t("match.intro.footnote")}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="pm-intro pm-intro--animated"
      variants={introContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div className="pm-intro__startup-demo" variants={introItem} aria-hidden="true">
        <span className="pm-intro__startup-aurora pm-intro__startup-aurora--one" />
        <span className="pm-intro__startup-aurora pm-intro__startup-aurora--two" />

        <div className="pm-intro__startup-top">
          <div className="pm-intro__startup-brand">
            <span className="pm-intro__avatar-shell">
              <span className="pm-intro__avatar-halo" />
              <PreludePigAvatar variant="intro" animate label="" />
            </span>
            <div>
              <p>PreludeMatch</p>
              <strong>Admissions consulting OS</strong>
            </div>
          </div>
          <span className="pm-intro__startup-live">Live plan</span>
        </div>

        <div className="pm-intro__startup-grid">
          <div className="pm-intro__startup-rail">
            {walkthroughSteps.map((step, index) => (
              <span key={step.label} className={`pm-intro__startup-step pm-intro__startup-step--${index + 1}`}>
                {step.label}
              </span>
            ))}
          </div>

          <div className="pm-intro__startup-canvas">
            <span className="pm-intro__demo-cursor" />

            <section className="pm-intro__startup-scene pm-intro__startup-scene--profile">
              <p>Student profile</p>
              <h3>Jordan needs a STEM admissions plan.</h3>
              <div className="pm-intro__startup-chips">
                <span>11th grade</span>
                <span>CS + engineering</span>
                <span>UCLA · Duke · Penn</span>
              </div>
            </section>

            <section className="pm-intro__startup-scene pm-intro__startup-scene--roadmap">
              <p>Consulting roadmap</p>
              <h3>Prelude turns goals into weekly execution.</h3>
              <div className="pm-intro__startup-bars">
                <span style={{ "--bar-width": "82%" }}>College list</span>
                <span style={{ "--bar-width": "68%" }}>Essays</span>
                <span style={{ "--bar-width": "46%" }}>Scholarships</span>
              </div>
            </section>

            <section className="pm-intro__startup-scene pm-intro__startup-scene--mentor">
              <p>Near-peer mentor</p>
              <h3>Matched with a mentor who has done the path.</h3>
              <div className="pm-intro__startup-mentor">
                <span>MP</span>
                <div>
                  <strong>Maya Patel</strong>
                  <small>Georgia Tech · STEM essays</small>
                </div>
                <b>96%</b>
              </div>
            </section>

            <section className="pm-intro__startup-scene pm-intro__startup-scene--essay">
              <p>Essay work</p>
              <h3>Feedback becomes visible progress.</h3>
              <div className="pm-intro__startup-doc">
                <span />
                <span />
                <span />
                <b>Mentor note: stronger opening</b>
              </div>
            </section>

            <section className="pm-intro__startup-scene pm-intro__startup-scene--rewards">
              <p>Rewards sync</p>
              <div className="pm-intro__startup-logo">
                <PreludeLogo className="pm-intro__logo" />
                <span>Essays, deadlines, scholarships, mentor notes, and coins stay connected.</span>
              </div>
              <div className="pm-intro__startup-coins">
                <span>+120</span>
                <span>+60</span>
              </div>
            </section>
          </div>
        </div>
      </motion.div>

      <motion.button
        type="button"
        className="pm-btn pm-btn--primary pm-btn--lg pm-intro__cta"
        onClick={onStart}
        variants={introItem}
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        <span className="pm-intro__cta-shine" aria-hidden="true" />
        <span className="pm-intro__cta-label">{t("match.intro.cta")}</span>
      </motion.button>

      <motion.p className="pm-intro__footnote" variants={introItem}>{t("match.intro.footnote")}</motion.p>
    </motion.div>
  );
}
