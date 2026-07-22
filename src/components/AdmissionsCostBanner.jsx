import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { usePreludeMotion } from "../context/MotionContext.jsx";
import {
  createCostBannerFakeCursorTimeline,
  formatSavingsAmount,
  savingsCountValue,
  SAVINGS_COUNT_DURATION_MS,
  SAVINGS_TARGET_AMOUNT
} from "../lib/admissionsCostBannerMotion.js";
import { useViewportActivity } from "../lib/motion/useViewportActivity.js";
import { shouldUseStaticLandingMotion } from "../lib/motion/motionPolicy.js";

const mediaBase = import.meta.env.BASE_URL;
const PIGGY_IMAGE = `${mediaBase}media/admissions-savings-piggy.png`;

function FakeCursorIcon() {
  return (
    <svg
      className="admissions-cost-banner__fake-cursor-svg"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        className="admissions-cost-banner__fake-cursor-pointer"
        d="M15.1 12.2C14.6 10.9 16 9.8 17.1 10.6L31.1 20.8C32.4 21.8 32 23.9 30.4 24.2L23.7 25.5L20.5 32C19.8 33.4 17.8 33.2 17.4 31.7L15.1 12.2Z"
        fill="currentColor"
        stroke="rgb(255 255 255 / 0.86)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdmissionsCostBanner() {
  const { t } = useLanguage();
  const { reducedMotion, motionTier } = usePreludeMotion();
  const staticMotion = shouldUseStaticLandingMotion({ reducedMotion, motionTier });
  const sectionRef = useRef(null);
  const savingsButtonRef = useRef(null);
  const headlineRef = useRef(null);
  const fakeCursorRef = useRef(null);
  const amountTextRef = useRef(null);
  const frameRef = useRef(0);
  const countStateRef = useRef({ elapsed: 0, startedAt: 0, running: false });
  const fakeTimelineRef = useRef(null);
  const demoCompleteRef = useRef(false);

  const [counting, setCounting] = useState(false);
  const { active } = useViewportActivity(sectionRef, {
    threshold: 0.35,
    rootMargin: "0px 0px -8% 0px"
  });

  const setSavingsDisplay = useCallback((value) => {
    if (amountTextRef.current) amountTextRef.current.textContent = formatSavingsAmount(value);
  }, []);

  const tickSavings = useCallback((now) => {
      const state = countStateRef.current;
      const elapsed = state.elapsed + (now - state.startedAt);
      const next = savingsCountValue(elapsed);
      setSavingsDisplay(next);

      if (elapsed < SAVINGS_COUNT_DURATION_MS) {
        frameRef.current = window.requestAnimationFrame(tickSavings);
        return;
      }

      frameRef.current = 0;
      state.elapsed = SAVINGS_COUNT_DURATION_MS;
      state.startedAt = 0;
      state.running = false;
      setCounting(false);
      setSavingsDisplay(SAVINGS_TARGET_AMOUNT);
      demoCompleteRef.current = true;
  }, [setSavingsDisplay]);

  const resumeSavingsCount = useCallback(() => {
    const state = countStateRef.current;
    if (!state.running || frameRef.current) return;
    state.startedAt = performance.now();
    setCounting(true);
    frameRef.current = window.requestAnimationFrame(tickSavings);
  }, [tickSavings]);

  const pauseSavingsCount = useCallback(() => {
    const state = countStateRef.current;
    if (!state.running || !frameRef.current) return;
    state.elapsed = Math.min(
      SAVINGS_COUNT_DURATION_MS,
      state.elapsed + (performance.now() - state.startedAt)
    );
    state.startedAt = 0;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setCounting(false);
  }, []);

  const runSavingsCount = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;

    if (staticMotion) {
      countStateRef.current = { elapsed: SAVINGS_COUNT_DURATION_MS, startedAt: 0, running: false };
      setCounting(false);
      setSavingsDisplay(SAVINGS_TARGET_AMOUNT);
      demoCompleteRef.current = true;
      return;
    }

    setSavingsDisplay(0);
    countStateRef.current = { elapsed: 0, startedAt: 0, running: true };
    resumeSavingsCount();
  }, [resumeSavingsCount, setSavingsDisplay, staticMotion]);

  const stopFakeCursor = useCallback(() => {
    fakeTimelineRef.current?.cancel();
    fakeTimelineRef.current = null;
  }, []);

  const resetSavingsDemo = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    countStateRef.current = { elapsed: 0, startedAt: 0, running: false };
    setCounting(false);
    demoCompleteRef.current = false;
    setSavingsDisplay(0);
  }, [setSavingsDisplay]);

  const startFakeCursor = useCallback(() => {
    stopFakeCursor();
    if (staticMotion || demoCompleteRef.current) {
      demoCompleteRef.current = true;
      setSavingsDisplay(SAVINGS_TARGET_AMOUNT);
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
  }, [resetSavingsDemo, runSavingsCount, setSavingsDisplay, staticMotion, stopFakeCursor]);

  useEffect(() => {
    if (!staticMotion) return;
    stopFakeCursor();
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    countStateRef.current = {
      elapsed: SAVINGS_COUNT_DURATION_MS,
      startedAt: 0,
      running: false
    };
    demoCompleteRef.current = true;
    setCounting(false);
    setSavingsDisplay(SAVINGS_TARGET_AMOUNT);
  }, [setSavingsDisplay, staticMotion, stopFakeCursor]);

  useEffect(() => {
    if (!active) {
      fakeTimelineRef.current?.pause();
      pauseSavingsCount();
      return undefined;
    }

    if (fakeTimelineRef.current) {
      fakeTimelineRef.current.play();
      resumeSavingsCount();
    } else {
      startFakeCursor();
    }

    let resizeFrame = 0;
    const onResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(startFakeCursor);
    };

    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(resizeFrame);
    };
  }, [active, pauseSavingsCount, resumeSavingsCount, startFakeCursor]);

  useEffect(() => () => {
    stopFakeCursor();
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  }, [stopFakeCursor]);

  return (
    <section
      ref={sectionRef}
      className={`admissions-cost-banner${active ? " admissions-cost-banner--demo-live" : ""}`}
      data-motion-active={active ? "true" : "false"}
      data-motion-tier={motionTier}
      id="about-cost"
      aria-labelledby="admissions-cost-headline"
    >
      {!staticMotion ? (
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
        <div className="admissions-cost-banner__visual">
          <div className="admissions-cost-banner__stage">
            <img
              src={PIGGY_IMAGE}
              alt={t("sections.cost.imageAlt")}
              className={`admissions-cost-banner__image admissions-cost-banner__piggy${active ? " admissions-cost-banner__piggy--float" : ""}`}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div className="admissions-cost-banner__copy">
          <p className="admissions-cost-banner__body max-w-lg text-lg leading-7 text-white md:text-xl md:leading-8">
            {t("sections.cost.bodyBefore")}{" "}
            <button
              ref={savingsButtonRef}
              type="button"
              className={`admissions-cost-banner__amount${counting ? " admissions-cost-banner__amount--counting" : ""}`}
              onClick={runSavingsCount}
              aria-label={staticMotion ? "Savings: $6,500" : "Animate savings from zero to $6,500"}
            >
              <span ref={amountTextRef} aria-live="polite">
                {formatSavingsAmount(staticMotion ? SAVINGS_TARGET_AMOUNT : 0)}
              </span>
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
        </div>
      </div>
    </section>
  );
}
