import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  createCostBannerFakeCursorTimeline,
  elementCenterPoint,
  formatSavingsAmount,
  savingsCountValue,
  SAVINGS_COUNT_DURATION_MS,
  SAVINGS_TARGET_AMOUNT
} from "../lib/admissionsCostBannerMotion.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import CoinBurst from "./interaction/CoinBurst.jsx";
import ScrollReveal from "./motion/ScrollReveal.jsx";

const mediaBase = import.meta.env.BASE_URL;
const PIGGY_IMAGE = `${mediaBase}media/admissions-savings-piggy.png`;

function FakeCursorIcon() {
  return (
    <svg
      className="admissions-cost-banner__fake-cursor-svg"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5.5 3.5L5.5 20.5L11.8 14.6L15.8 24.2L19.2 22.8L14.8 13.4L21.5 13.4L5.5 3.5Z"
        fill="#111111"
        stroke="#FFFFFF"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdmissionsCostBanner() {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const savingsButtonRef = useRef(null);
  const headlineRef = useRef(null);
  const fakeCursorRef = useRef(null);
  const frameRef = useRef(0);
  const fakeTimelineRef = useRef(null);
  const demoCompleteRef = useRef(false);

  const [savingsValue, setSavingsValue] = useState(0);
  const [counting, setCounting] = useState(false);
  const [coinBurst, setCoinBurst] = useState(null);
  const [demoLive, setDemoLive] = useState(false);

  const triggerCoinBurst = useCallback(() => {
    setCoinBurst({
      id: Date.now(),
      origin: elementCenterPoint(savingsButtonRef.current)
    });
  }, []);

  const runSavingsCount = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    setCoinBurst(null);
    setSavingsValue(0);

    if (reducedMotion) {
      setCounting(false);
      setSavingsValue(SAVINGS_TARGET_AMOUNT);
      triggerCoinBurst();
      return;
    }

    setCounting(true);
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const next = savingsCountValue(elapsed);
      setSavingsValue(next);

      if (elapsed < SAVINGS_COUNT_DURATION_MS) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      frameRef.current = 0;
      setCounting(false);
      setSavingsValue(SAVINGS_TARGET_AMOUNT);
      demoCompleteRef.current = true;
      triggerCoinBurst();
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }, [reducedMotion, triggerCoinBurst]);

  const stopFakeCursor = useCallback(() => {
    fakeTimelineRef.current?.cancel();
    fakeTimelineRef.current = null;
  }, []);

  const resetSavingsDemo = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setCoinBurst(null);
    setCounting(false);
    demoCompleteRef.current = false;
    setSavingsValue(0);
  }, []);

  const startFakeCursor = useCallback(() => {
    stopFakeCursor();
    if (reducedMotion || demoCompleteRef.current) {
      setSavingsValue(SAVINGS_TARGET_AMOUNT);
      return;
    }

    resetSavingsDemo();

    fakeTimelineRef.current = createCostBannerFakeCursorTimeline({
      sectionEl: sectionRef.current,
      cursorEl: fakeCursorRef.current,
      amountEl: savingsButtonRef.current,
      headlineEl: headlineRef.current,
      onReset: resetSavingsDemo,
      onActivate: runSavingsCount
    });
    fakeTimelineRef.current?.play();
  }, [reducedMotion, resetSavingsDemo, runSavingsCount, stopFakeCursor]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setDemoLive(false);
          stopFakeCursor();
          if (reducedMotion || demoCompleteRef.current) {
            setSavingsValue(SAVINGS_TARGET_AMOUNT);
          } else {
            resetSavingsDemo();
          }
          return;
        }

        setDemoLive(true);
        startFakeCursor();
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(section);

    const onResize = () => {
      if (!fakeTimelineRef.current) return;
      startFakeCursor();
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      stopFakeCursor();
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [resetSavingsDemo, startFakeCursor, stopFakeCursor]);

  return (
    <section
      ref={sectionRef}
      className={`admissions-cost-banner${demoLive ? " admissions-cost-banner--demo-live" : ""}`}
      id="about-cost"
      aria-labelledby="admissions-cost-headline"
    >
      {!reducedMotion ? (
        <>
          <span
            ref={fakeCursorRef}
            className="admissions-cost-banner__fake-cursor"
            aria-hidden="true"
          >
            <FakeCursorIcon />
          </span>
        </>
      ) : null}
      <div className="admissions-cost-banner__inner">
        <ScrollReveal className="admissions-cost-banner__visual">
          <div className="admissions-cost-banner__stage">
            <img
              src={PIGGY_IMAGE}
              alt={t("sections.cost.imageAlt")}
              className={`admissions-cost-banner__image admissions-cost-banner__piggy${demoLive ? " admissions-cost-banner__piggy--float" : ""}`}
            />
          </div>
        </ScrollReveal>

        <ScrollReveal className="admissions-cost-banner__copy" delay={0.12}>
          <p className="admissions-cost-banner__body max-w-lg text-lg leading-7 text-white md:text-xl md:leading-8">
            {t("sections.cost.bodyBefore")}{" "}
            <button
              ref={savingsButtonRef}
              type="button"
              className={`admissions-cost-banner__amount${counting ? " admissions-cost-banner__amount--counting" : ""}`}
              onClick={runSavingsCount}
              aria-label="Animate savings from zero to $6,500"
            >
              <span aria-live="polite">{formatSavingsAmount(savingsValue)}</span>
            </button>{" "}
            {t("sections.cost.bodyAfter")}
          </p>
          <div className="admissions-cost-banner__headline-wrap">
            <h2
              ref={headlineRef}
              id="admissions-cost-headline"
              className="admissions-cost-banner__headline ivy-display mt-6 max-w-xl text-5xl font-extrabold uppercase leading-[0.88] tracking-[-0.035em] text-white md:text-7xl lg:text-[5.8rem]"
            >
              {t("sections.cost.headline")}
            </h2>
          </div>
        </ScrollReveal>
      </div>
      <CoinBurst
        key={coinBurst?.id}
        active={Boolean(coinBurst)}
        amount={null}
        origin={coinBurst?.origin}
        onDone={() => setCoinBurst(null)}
      />
    </section>
  );
}
