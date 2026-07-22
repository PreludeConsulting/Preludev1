// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  motionState: {
    reducedMotion: false,
    motionTier: "full",
    documentVisible: true
  }
}));

vi.mock("../src/context/MotionContext.jsx", () => ({
  usePreludeMotion: () => mocks.motionState
}));

import AuraCursor from "../src/components/motion/AuraCursor.jsx";

let host;
let rendererHost;
let root;
let nextFrameId;
let frames;

function pointerEvent(type, options = {}) {
  return new MouseEvent(type, { bubbles: true, ...options });
}

describe("AuraCursor lifecycle", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.motionState.reducedMotion = false;
    mocks.motionState.motionTier = "full";
    mocks.motionState.documentVisible = true;
    nextFrameId = 1;
    frames = new Map();

    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    })));
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id) => {
      frames.delete(id);
    }));

    host = document.createElement("div");
    host.innerHTML = '<main data-landing-content><button type="button">Start</button></main>';
    document.body.appendChild(host);
    rendererHost = document.createElement("div");
    document.body.appendChild(rendererHost);
    root = createRoot(rendererHost);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    document.body.replaceChildren();
    root = null;
    host = null;
    rendererHost = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("owns pointer tracking only while a landing control is hovered and drains settled RAF work", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");

    act(() => root.render(<AuraCursor />));

    expect(addListener.mock.calls.filter(([type]) => type === "pointermove")).toHaveLength(0);

    const button = host.querySelector("button");
    act(() => {
      button.dispatchEvent(pointerEvent("pointerover", { clientX: 32, clientY: 48 }));
    });

    expect(addListener.mock.calls.filter(([type]) => type === "pointermove")).toHaveLength(1);
    expect(frames.size).toBe(1);

    const [[frameId, paint]] = frames;
    frames.delete(frameId);
    act(() => paint(16));

    expect(frames.size).toBe(0);

    act(() => {
      button.dispatchEvent(pointerEvent("pointermove", { clientX: 80, clientY: 90 }));
      button.dispatchEvent(pointerEvent("pointerout", { clientX: 80, clientY: 90 }));
    });

    expect(removeListener.mock.calls.filter(([type]) => type === "pointermove")).toHaveLength(1);
    expect(frames.size).toBe(0);
    expect(document.querySelector(".aura-cursor").classList.contains("aura-cursor--visible")).toBe(false);
  });

  it("does not restore stale visibility after motion eligibility toggles", () => {
    act(() => root.render(<AuraCursor />));
    const button = host.querySelector("button");
    act(() => {
      button.dispatchEvent(pointerEvent("pointerover", { clientX: 32, clientY: 48 }));
    });
    expect(document.querySelector(".aura-cursor").classList.contains("aura-cursor--visible")).toBe(true);

    mocks.motionState.documentVisible = false;
    act(() => root.render(<AuraCursor />));
    expect(document.querySelector(".aura-cursor")).toBeNull();

    mocks.motionState.documentVisible = true;
    act(() => root.render(<AuraCursor />));
    expect(document.querySelector(".aura-cursor").classList.contains("aura-cursor--visible")).toBe(false);
  });
});
