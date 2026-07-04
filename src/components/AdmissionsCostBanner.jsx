import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { runCostBannerCursorLoop } from "../lib/admissionsCostBannerMotion.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import ScrollReveal from "./motion/ScrollReveal.jsx";

const mediaBase = import.meta.env.BASE_URL;
const PIGGY_IMAGE = `${mediaBase}media/admissions-savings-piggy.png`;

function DemoCursorIcon({ shadowId }) {
  return (
    <svg
      className="admissions-cost-banner__cursor-svg"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#1e1b4b" floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        <path
          d="M5.5 3.5L5.5 20.5L11.8 14.6L15.8 24.2L19.2 22.8L14.8 13.4L21.5 13.4L5.5 3.5Z"
          fill="#FFFFFF"
          stroke="#312E81"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export default function AdmissionsCostBanner() {
  const { t } = useLanguage();
  const cursorShadowId = useId().replace(/:/g, "");
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const entryRef = useRef(null);
  const badgeRef = useRef(null);
  const headlineRef = useRef(null);
  const loopRef = useRef(null);

  const [badgeActive, setBadgeActive] = useState(false);
  const [headlineActive, setHeadlineActive] = useState(false);
  const [demoLive, setDemoLive] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const startLoop = () => {
      loopRef.current?.cancel();
      loopRef.current = runCostBannerCursorLoop({
        sectionEl: section,
        cursorEl: cursorRef.current,
        ringEl: ringRef.current,
        targets: {
          entry: entryRef.current,
          badge: badgeRef.current,
          headline: headlineRef.current
        },
        onBadgeActive: setBadgeActive,
        onHeadlineActive: setHeadlineActive,
        reducedMotion
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          loopRef.current?.cancel();
          loopRef.current = null;
          setDemoLive(false);
          setBadgeActive(false);
          setHeadlineActive(false);
          return;
        }

        setDemoLive(true);
        startLoop();
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(section);

    const onResize = () => {
      if (!loopRef.current) return;
      loopRef.current.cancel();
      startLoop();
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      loopRef.current?.cancel();
      loopRef.current = null;
    };
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className={`admissions-cost-banner${demoLive ? " admissions-cost-banner--demo-live" : ""}`}
      id="about-cost"
      aria-labelledby="admissions-cost-headline"
    >
      <span
        ref={cursorRef}
        className="admissions-cost-banner__demo-cursor admissions-cost-banner__demo-cursor--hidden"
        aria-hidden="true"
      >
        <span className="admissions-cost-banner__cursor-trail" />
        <DemoCursorIcon shadowId={`cost-cursor-shadow-${cursorShadowId}`} />
      </span>

      <span
        ref={ringRef}
        className="admissions-cost-banner__click-ring"
        aria-hidden="true"
      />

      <div className="admissions-cost-banner__inner">
        <ScrollReveal className="admissions-cost-banner__visual">
          <div className="admissions-cost-banner__stage">
            <img
              src={PIGGY_IMAGE}
              alt={t("sections.cost.imageAlt")}
              className={`admissions-cost-banner__image admissions-cost-banner__piggy${demoLive ? " admissions-cost-banner__piggy--float" : ""}`}
            />
            <span
              className={`admissions-cost-banner__badge-pulse${badgeActive ? " admissions-cost-banner__badge-pulse--active" : ""}`}
              aria-hidden="true"
            />
            <span ref={entryRef} className="admissions-cost-banner__hotspot admissions-cost-banner__hotspot--entry" aria-hidden="true" />
            <span ref={badgeRef} className="admissions-cost-banner__hotspot admissions-cost-banner__hotspot--badge" aria-hidden="true" />
          </div>
        </ScrollReveal>

        <ScrollReveal className="admissions-cost-banner__copy" delay={0.12}>
          <p className="admissions-cost-banner__body max-w-lg text-lg leading-7 text-white md:text-xl md:leading-8">
            {t("sections.cost.bodyBefore")}{" "}
            <span className="admissions-cost-banner__amount">$6,500</span>{" "}
            {t("sections.cost.bodyAfter")}
          </p>
          <div
            className={`admissions-cost-banner__headline-wrap${headlineActive ? " admissions-cost-banner__headline-wrap--shine" : ""}`}
          >
            <h2
              ref={headlineRef}
              id="admissions-cost-headline"
              className={`admissions-cost-banner__headline ivy-display mt-6 max-w-xl text-5xl font-extrabold uppercase leading-[0.88] tracking-[-0.035em] text-white md:text-7xl lg:text-[5.8rem]${headlineActive ? " admissions-cost-banner__headline--glow" : ""}`}
            >
              {t("sections.cost.headline")}
            </h2>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
