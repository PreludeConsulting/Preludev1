import { useEffect, useRef, useState } from "react";
import { createScope } from "animejs";
import PreludeMatchCinematicBeats, {
  PreludeMatchCinematicStatic
} from "./PreludeMatchCinematicBeats.jsx";
import {
  buildPreludeMatchCinematicTimeline,
  getCinematicDurationMs
} from "../../lib/preludeMatchCinematicMotion.js";
import { initPreludeMatchCinematicRuntime } from "../../lib/preludeMatchCinematicRuntime.js";

function useMobileCinematic() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = (event) => setMobile(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return mobile;
}

function resetCinematicLayers(runtime) {
  runtime?.resetInitialStates?.();
  runtime?.showOpener?.();
}

export default function PreludeMatchIntro({ reducedMotion, onStart }) {
  const mobile = useMobileCinematic();
  const rootRef = useRef(null);
  const scopeRef = useRef(null);
  const timelineRef = useRef(null);
  const runtimeRef = useRef(null);
  const hoveredRef = useRef(false);
  const inViewRef = useRef(true);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const container = rootRef.current;
    if (!container) return undefined;

    const cinematicRoot = container.querySelector(".pm-cinematic") ?? container;

    scopeRef.current = createScope({ root: rootRef }).add(() => {
      try {
        const runtime = initPreludeMatchCinematicRuntime(cinematicRoot, { mobile });
        runtimeRef.current = runtime;

        if (!runtime.elements.openerBeat) {
          console.error("PreludeMatch cinematic: opener beat not found");
          return;
        }

        const timeline = buildPreludeMatchCinematicTimeline({
          mobile,
          runtime,
          onUpdate: (self) => {
            container.dataset.cinematicCurrentMs = String(Math.round(self.currentTime));
          },
          onLoopReset: () => resetCinematicLayers(runtime),
          onLoop: () => {
            container.dataset.cinematicLoops = String(Number(container.dataset.cinematicLoops || 0) + 1);
          }
        });

        runtime.showOpener();
        timelineRef.current = timeline;
        timeline.play();
        hasStartedRef.current = true;
        container.dataset.cinematicReady = "1";
      } catch (error) {
        console.error("PreludeMatch cinematic failed to start", error);
        runtimeRef.current?.showOpener?.();
      }
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        const timeline = timelineRef.current;
        if (!timeline || !hasStartedRef.current) return;
        inViewRef.current = entry.isIntersecting;
        if (!entry.isIntersecting || hoveredRef.current) {
          timeline.pause();
          return;
        }
        timeline.play();
      },
      { threshold: 0.01 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      hasStartedRef.current = false;
      timelineRef.current?.pause?.();
      timelineRef.current = null;
      runtimeRef.current?.revert?.();
      runtimeRef.current = null;
      scopeRef.current?.revert?.();
      scopeRef.current = null;
    };
  }, [reducedMotion, mobile]);

  function handlePointerEnter() {
    hoveredRef.current = true;
    timelineRef.current?.pause?.();
  }

  function handlePointerLeave() {
    hoveredRef.current = false;
    if (inViewRef.current) {
      timelineRef.current?.play?.();
    }
  }

  function handleDemoStart(event) {
    event.stopPropagation();
    timelineRef.current?.pause?.();
    onStart();
  }

  if (reducedMotion) {
    return (
      <div
        className="pm-intro pm-intro--cinematic pm-intro--static"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <PreludeMatchCinematicStatic />
        <div className="pm-cinematic__demo-overlay">
          <button type="button" className="pm-cinematic__demo-trigger" onClick={handleDemoStart}>
            Try PreludeMatch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="pm-intro pm-intro--cinematic"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      data-cinematic-duration-ms={getCinematicDurationMs(mobile)}
    >
      <span className="sr-only">
        College admissions made simple. PreludeMatch mentor matching, dashboard tasks, and progress.
        Try PreludeMatch to start the demo.
      </span>
      <PreludeMatchCinematicBeats mobile={mobile} />
      <div className="pm-cinematic__demo-overlay">
        <button type="button" className="pm-cinematic__demo-trigger" onClick={handleDemoStart}>
          Try PreludeMatch
        </button>
      </div>
    </div>
  );
}
