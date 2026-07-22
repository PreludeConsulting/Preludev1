// @vitest-environment happy-dom
import React, { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  motionState: {
    reducedMotion: false,
    motionTier: "lite",
    documentVisible: true
  },
  viewportActive: true,
  enter: vi.fn(() => ({ revert: vi.fn() })),
  stagger: vi.fn(() => ({ revert: vi.fn() })),
  scrub: vi.fn(() => ({ revert: vi.fn() }))
}));

vi.mock("../src/context/MotionContext.jsx", () => ({
  usePreludeMotion: () => mocks.motionState
}));

vi.mock("../src/lib/useReducedMotion.js", () => ({
  useReducedMotion: () => mocks.motionState.reducedMotion
}));

vi.mock("../src/lib/motion/useViewportActivity.js", () => ({
  useViewportActivity: () => ({
    active: mocks.viewportActive,
    inViewport: mocks.viewportActive
  })
}));

vi.mock("../src/context/LanguageContext.jsx", () => ({
  useLanguage: () => ({ t: (key) => key })
}));

vi.mock("../src/lib/animeScrollMotion.js", () => ({
  SCROLL_OBSERVER_DEBUG: false,
  createEnterReveal: mocks.enter,
  createStaggerReveal: mocks.stagger,
  createScrollScrub: mocks.scrub
}));

import AdmissionsCostBanner from "../src/components/AdmissionsCostBanner.jsx";
import {
  useScrollEnterReveal,
  useScrollScrubbedAnimation,
  useScrollStaggerReveal,
  useSetPieceAnimation
} from "../src/lib/useAnimeScrollAnimation.js";

let host;
let root;
let nextFrameId;
let frames;

function ScrollHooksHarness({ mountSetPiece }) {
  const enterRef = useRef(null);
  const containerRef = useRef(null);
  const childRefs = useRef([]);
  const targetRef = useRef(null);
  const sectionRef = useRef(null);
  const setPieceRefs = useRef({ headline: { style: {} } });

  useScrollEnterReveal(enterRef);
  useScrollStaggerReveal(containerRef, childRefs);
  useScrollScrubbedAnimation(targetRef, sectionRef, { props: { rotate: "1turn" } });
  useSetPieceAnimation(mountSetPiece, setPieceRefs);

  return (
    <section ref={sectionRef}>
      <div ref={enterRef}>Enter</div>
      <div ref={containerRef}>
        <span ref={(node) => { childRefs.current[0] = node; }}>Child</span>
      </div>
      <div ref={targetRef}>Scrub</div>
    </section>
  );
}

describe("lite landing motion enforcement", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.motionState.reducedMotion = false;
    mocks.motionState.motionTier = "lite";
    mocks.viewportActive = true;
    mocks.enter.mockClear();
    mocks.stagger.mockClear();
    mocks.scrub.mockClear();
    nextFrameId = 1;
    frames = new Map();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id) => frames.delete(id)));
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("passes static-motion semantics to every Anime scroll entry point", () => {
    const mountSetPiece = vi.fn(() => ({ revert: vi.fn() }));
    act(() => root.render(<ScrollHooksHarness mountSetPiece={mountSetPiece} />));
    act(() => {
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback(16);
      }
    });

    expect(mocks.enter.mock.calls[0][1].reducedMotion).toBe(true);
    expect(mocks.stagger.mock.calls[0][2].reducedMotion).toBe(true);
    expect(mocks.scrub.mock.calls[0][2].reducedMotion).toBe(true);
    expect(mountSetPiece.mock.calls[0][1]).toEqual({ reducedMotion: true });
  });

  it.each([
    ["reduced", true],
    ["lite", false]
  ])("renders the final savings value immediately for %s motion", (motionTier, reducedMotion) => {
    mocks.motionState.motionTier = motionTier;
    mocks.motionState.reducedMotion = reducedMotion;
    const addListener = vi.spyOn(window, "addEventListener");

    act(() => root.render(<AdmissionsCostBanner />));

    expect(host.querySelector(".admissions-cost-banner__amount span").textContent).toBe("$6,500");
    expect(host.querySelector(".admissions-cost-banner__fake-cursor")).toBeNull();
    expect(addListener.mock.calls.filter(([type]) => type === "resize")).toHaveLength(0);
    expect(frames.size).toBe(0);
  });
});
