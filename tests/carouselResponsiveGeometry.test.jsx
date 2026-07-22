// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/context/MotionContext.jsx", () => ({
  usePreludeMotion: () => ({ reducedMotion: false, motionTier: "full" })
}));

vi.mock("../src/lib/motion/useViewportActivity.js", () => ({
  useViewportActivity: () => ({ active: true, inViewport: true })
}));

vi.mock("motion/react", async () => {
  const ReactModule = await import("react");
  return {
    motion: {
      div: ReactModule.forwardRef(function MotionDiv(
        {
          animate,
          transition: _transition,
          drag: _drag,
          dragConstraints,
          onDragEnd: _onDragEnd,
          onAnimationStart: _onAnimationStart,
          onAnimationComplete: _onAnimationComplete,
          ...props
        },
        ref
      ) {
        return ReactModule.createElement("div", {
          ...props,
          ref,
          "data-animate-x": animate?.x,
          "data-drag-left": dragConstraints?.left
        });
      }),
      button: ReactModule.forwardRef(function MotionButton(
        { animate: _animate, transition: _transition, ...props },
        ref
      ) {
        return ReactModule.createElement("button", { ...props, ref });
      })
    }
  };
});

import Carousel from "../src/components/student-network/Carousel.jsx";

let host;
let root;
let observers;

class MockResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    observers.push(this);
  }
}

const ITEMS = [
  { id: 1, title: "One", description: "First", icon: <span aria-hidden="true">1</span> },
  { id: 2, title: "Two", description: "Second", icon: <span aria-hidden="true">2</span> }
];

describe("Carousel responsive geometry", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    observers = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("updates card and track widths from the observed content box", () => {
    act(() => {
      root.render(<Carousel items={ITEMS} baseWidth={300} />);
    });

    expect(observers).toHaveLength(1);
    const container = host.querySelector(".carousel-container");
    const track = host.querySelector(".carousel-track");
    expect(observers[0].observe).toHaveBeenCalledWith(container);
    expect(track.style.width).toBe("268px");

    act(() => {
      observers[0].callback([
        {
          target: container,
          contentRect: { width: 206 },
          contentBoxSize: [{ inlineSize: 206 }]
        }
      ]);
    });

    expect(track.style.width).toBe("206px");
    expect([...host.querySelectorAll(".carousel-item")].every((item) => item.style.width === "206px")).toBe(true);
    expect(track.dataset.dragLeft).toBe("-222");

    act(() => host.querySelectorAll(".carousel-indicator")[1].click());
    expect(track.dataset.animateX).toBe("-222");

    act(() => root.unmount());
    root = null;
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
