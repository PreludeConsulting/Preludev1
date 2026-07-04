import { useCallback, useEffect, useRef, useState } from "react";
import { animate, createTimeline } from "animejs";
import {
  buildCalloutSlot,
  CALLOUT_CROSSFADE_MS,
  CALLOUT_CROSSFADE_OVERLAP_MS,
  CALLOUT_HOLD_AFTER_TYPE_MS,
  CALLOUT_TYPING_STAGGER_MS,
  CALLOUT_TYPING_WORD_MS
} from "../lib/networkStatCallouts.js";

function splitWords(text) {
  return text.split(/(\s+)/).filter(Boolean);
}

function CalloutPill({ row }) {
  return (
    <div className="network-map__callout-pill">
      <span className="network-map__callout-pill-value network-callout-word network-callout-word--hidden">
        {row.value}
      </span>
      <span className="network-map__callout-pill-label">
        {splitWords(row.title).map((token, index) =>
          /^\s+$/.test(token) ? (
            <span key={`space-${index}`} className="network-callout-space" aria-hidden="true">
              {token}
            </span>
          ) : (
            <span key={`word-${index}`} className="network-callout-word network-callout-word--hidden">
              {token}
            </span>
          )
        )}
      </span>
    </div>
  );
}

function AccessibleMetricsList({ metrics }) {
  return (
    <ul className="sr-only">
      {metrics.map((row) => (
        <li key={row.title}>
          <strong>
            {row.value} {row.title}
          </strong>
          : {row.description}
        </li>
      ))}
    </ul>
  );
}

function runTypingOnSlot(slotEl, reducedMotion) {
  if (!slotEl) return Promise.resolve();

  const words = slotEl.querySelectorAll(".network-callout-word");
  if (!words.length || reducedMotion) {
    words.forEach((word) => word.classList.remove("network-callout-word--hidden"));
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    words.forEach((word) => word.classList.add("network-callout-word--hidden"));

    const timeline = createTimeline({
      defaults: { ease: "out(2)" },
      onComplete: resolve
    });

    words.forEach((word, index) => {
      timeline.add(
        word,
        {
          opacity: [0, 1],
          duration: CALLOUT_TYPING_WORD_MS,
          onBegin: () => word.classList.remove("network-callout-word--hidden")
        },
        index * CALLOUT_TYPING_STAGGER_MS
      );
    });
  });
}

export default function NetworkStatCallouts({ metrics, mapRef, reducedMotion = false }) {
  const calloutsRootRef = useRef(null);
  const slotRefs = useRef([null, null]);
  const motionRefs = useRef([]);
  const holdTimerRef = useRef(0);
  const cycleRunRef = useRef(0);
  const animatingRef = useRef(false);
  const visibleRef = useRef(false);
  const activeSlotRef = useRef(0);
  const zoneIndexRef = useRef(-1);
  const slotStateRef = useRef([]);

  const [slots, setSlots] = useState(() => {
    const first = buildCalloutSlot(0, -1);
    const second = buildCalloutSlot(1, first.zoneIndex);
    return [first, second];
  });

  slotStateRef.current = slots;

  const cancelMotions = useCallback(() => {
    motionRefs.current.forEach((motion) => motion?.pause?.());
    motionRefs.current = [];
  }, []);

  const clearHoldTimer = useCallback(() => {
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = 0;
  }, []);

  const hideCallouts = useCallback(() => {
    cancelMotions();
    clearHoldTimer();
    animatingRef.current = false;
    visibleRef.current = false;
    calloutsRootRef.current?.classList.add("network-map__callouts--paused");
    slotRefs.current.forEach((el) => {
      if (!el) return;
      el.style.opacity = "0";
    });
  }, [cancelMotions, clearHoldTimer]);

  const showCallouts = useCallback(() => {
    calloutsRootRef.current?.classList.remove("network-map__callouts--paused");
    const activeEl = slotRefs.current[activeSlotRef.current];
    if (activeEl) activeEl.style.opacity = "1";
  }, []);

  const runCrossfade = useCallback(
    (fromSlot, toSlot, nextSlotState) =>
      new Promise((resolve) => {
        const outEl = slotRefs.current[fromSlot];
        const inEl = slotRefs.current[toSlot];
        if (!outEl || !inEl) {
          resolve();
          return;
        }

        animatingRef.current = true;

        setSlots((prev) => {
          const next = [...prev];
          next[toSlot] = nextSlotState;
          return next;
        });

        inEl.style.opacity = "0";
        inEl.style.left = nextSlotState.left;
        inEl.style.top = nextSlotState.top;

        inEl.querySelectorAll(".network-callout-word").forEach((word) => {
          word.classList.add("network-callout-word--hidden");
          word.style.opacity = "0";
        });

        requestAnimationFrame(() => {
          const outMotion = animate(outEl, {
            opacity: [1, 0],
            duration: CALLOUT_CROSSFADE_MS,
            ease: "out(2)"
          });

          const inMotion = animate(inEl, {
            opacity: [0, 1],
            duration: CALLOUT_CROSSFADE_MS,
            ease: "out(2)",
            delay: CALLOUT_CROSSFADE_OVERLAP_MS,
            onComplete: () => {
              animatingRef.current = false;
              activeSlotRef.current = toSlot;
              motionRefs.current = motionRefs.current.filter(
                (motion) => motion !== outMotion && motion !== inMotion
              );
              resolve();
            }
          });

          motionRefs.current.push(outMotion, inMotion);
        });
      }),
    []
  );

  const runCycleStep = useCallback(async () => {
    const runId = cycleRunRef.current;
    if (!visibleRef.current || reducedMotion) return;

    const activeSlot = activeSlotRef.current;
    const inactiveSlot = 1 - activeSlot;
    const currentStatIndex = slotStateRef.current[activeSlot]?.statIndex ?? 0;
    const activeEl = slotRefs.current[activeSlot];

    await runTypingOnSlot(activeEl, reducedMotion);
    if (runId !== cycleRunRef.current || !visibleRef.current) return;

    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(async () => {
      if (runId !== cycleRunRef.current || !visibleRef.current || animatingRef.current) return;

      const nextStatIndex = (currentStatIndex + 1) % metrics.length;
      const nextSlotState = buildCalloutSlot(nextStatIndex, zoneIndexRef.current);
      zoneIndexRef.current = nextSlotState.zoneIndex;

      await runCrossfade(activeSlot, inactiveSlot, nextSlotState);
      if (runId !== cycleRunRef.current || !visibleRef.current) return;

      runCycleStep();
    }, CALLOUT_HOLD_AFTER_TYPE_MS);
  }, [clearHoldTimer, metrics.length, reducedMotion, runCrossfade]);

  const startCycle = useCallback(() => {
    cycleRunRef.current += 1;
    visibleRef.current = true;
    showCallouts();
    runCycleStep();
  }, [runCycleStep, showCallouts]);

  const stopCycle = useCallback(() => {
    cycleRunRef.current += 1;
    hideCallouts();
  }, [hideCallouts]);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const mapEl = mapRef?.current;
    if (!mapEl) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        if (inView) {
          if (!visibleRef.current) startCycle();
        } else {
          stopCycle();
        }
      },
      { threshold: [0, 0.2, 0.35, 0.5] }
    );

    observer.observe(mapEl);

    return () => {
      observer.disconnect();
      stopCycle();
    };
  }, [mapRef, reducedMotion, startCycle, stopCycle]);

  useEffect(() => {
    activeSlotRef.current = 0;
    zoneIndexRef.current = slots[0]?.zoneIndex ?? 0;

    slotRefs.current.forEach((el, index) => {
      if (!el) return;
      el.style.opacity = index === 0 ? "1" : "0";
      el.style.left = slots[index]?.left ?? "8%";
      el.style.top = slots[index]?.top ?? "12%";
    });
  }, []);

  if (reducedMotion) {
    return (
      <>
        <AccessibleMetricsList metrics={metrics} />
        <div className="network-map__callouts network-map__callouts--static" aria-hidden="true">
          <ul className="network-map__callouts-static-grid">
            {metrics.map((row) => (
              <li key={row.title} className="network-map__callouts-static-item">
                <div className="network-map__callout-pill network-map__callout-pill--static">
                  <span className="network-map__callout-pill-value">{row.value}</span>
                  <span className="network-map__callout-pill-label">{row.title}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  return (
    <>
      <AccessibleMetricsList metrics={metrics} />
      <div ref={calloutsRootRef} className="network-map__callouts" aria-hidden="true">
        {slots.map((slot, index) => (
          <div
            key={index}
            ref={(node) => {
              slotRefs.current[index] = node;
            }}
            className="network-map__callout-slot"
            style={{
              left: slot.left,
              top: slot.top
            }}
          >
            <CalloutPill row={metrics[slot.statIndex]} />
          </div>
        ))}
      </div>
    </>
  );
}
