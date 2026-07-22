// @vitest-environment happy-dom
import React, { act, forwardRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const ReactModule = await import("react");
  const motionElement = (tag) => forwardRef(function MotionElement(
    { animate: _animate, initial: _initial, transition: _transition, ...props },
    ref
  ) {
    return ReactModule.createElement(tag, { ...props, ref });
  });
  return {
    motion: {
      div: motionElement("div"),
      p: motionElement("p")
    }
  };
});

vi.mock("../src/components/hero/PreludePigAvatar.jsx", () => ({
  default: () => <div data-testid="pig-avatar" />
}));

import PreludeMatchLoading from "../src/components/hero/PreludeMatchLoading.jsx";

let host;
let root;
let frames;
let nextFrameId;

describe("PreludeMatchLoading progress lifecycle", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    frames = new Map();
    nextFrameId = 1;
    vi.spyOn(performance, "now").mockReturnValue(1000);
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

  it("writes progress through scaleX and cancels the outstanding frame on unmount", () => {
    act(() => root.render(<PreludeMatchLoading progressFrom={90} reducedMotion={false} />));

    const progress = host.querySelector("[role=progressbar]");
    const fill = host.querySelector(".pm-progress__fill");
    expect(fill.style.width).toBe("100%");
    expect(fill.style.transform).toBe("scaleX(0.9)");
    expect(progress.getAttribute("aria-valuenow")).toBe("90");
    expect(frames.size).toBe(1);

    const [[frameId, tick]] = frames;
    frames.delete(frameId);
    act(() => tick(2700));

    expect(fill.style.transform).toBe("scaleX(0.95)");
    expect(progress.getAttribute("aria-valuenow")).toBe("95");
    expect(frames.size).toBe(1);

    const outstandingFrame = [...frames.keys()][0];
    act(() => root.unmount());
    root = null;

    expect(cancelAnimationFrame).toHaveBeenCalledWith(outstandingFrame);
    expect(frames.size).toBe(0);
  });

  it("renders completed progress without scheduling a frame for reduced motion", () => {
    act(() => root.render(<PreludeMatchLoading progressFrom={90} reducedMotion />));

    const progress = host.querySelector("[role=progressbar]");
    const fill = host.querySelector(".pm-progress__fill");
    expect(fill.style.transform).toBe("scaleX(1)");
    expect(progress.getAttribute("aria-valuenow")).toBe("100");
    expect(frames.size).toBe(0);
  });
});
