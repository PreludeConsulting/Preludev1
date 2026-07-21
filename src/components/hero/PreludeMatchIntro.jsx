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
import { usePreludeMotion } from "../../context/MotionContext.jsx";
import { useViewportActivity } from "../../lib/motion/useViewportActivity.js";

function useMobileCinematic() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = (event) => setMobile(event.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener?.(onChange);
    return () => media.removeListener?.(onChange);
  }, []);

  return mobile;
}

function resetCinematicLayers(runtime) {
  runtime?.resetInitialStates?.();
  runtime?.showOpener?.();
}

export default function PreludeMatchIntro({ reducedMotion, onStart }) {
  const mobile = useMobileCinematic();
  const { motionTier } = usePreludeMotion();
  const rootRef = useRef(null);
  const { active } = useViewportActivity(rootRef);
  const scopeRef = useRef(null);
  const timelineRef = useRef(null);
  const runtimeRef = useRef(null);
  const hoveredRef = useRef(false);
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
          lite: motionTier === "lite",
          runtime,
          onLoopReset: () => resetCinematicLayers(runtime)
        });

        runtime.showOpener();
        timelineRef.current = timeline;
        if (active) timeline.play();
        hasStartedRef.current = true;
      } catch (error) {
        console.error("PreludeMatch cinematic failed to start", error);
        runtimeRef.current?.showOpener?.();
      }
    });

    return () => {
      hasStartedRef.current = false;
      timelineRef.current?.pause?.();
      timelineRef.current = null;
      runtimeRef.current?.revert?.();
      runtimeRef.current = null;
      scopeRef.current?.revert?.();
      scopeRef.current = null;
    };
  }, [mobile, motionTier, reducedMotion]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline || !hasStartedRef.current) return;
    if (active && !hoveredRef.current) timeline.play();
    else timeline.pause();
  }, [active]);

  function handlePointerEnter() {
    hoveredRef.current = true;
    timelineRef.current?.pause?.();
  }

  function handlePointerLeave() {
    hoveredRef.current = false;
    if (active) {
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
      className={`pm-intro pm-intro--cinematic${active ? " pm-intro--motion-active" : ""}${motionTier === "lite" ? " pm-intro--lite" : ""}`}
      data-motion-active={active ? "true" : "false"}
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
