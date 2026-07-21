// @vitest-environment happy-dom
import React, { StrictMode, act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppLink from "../src/components/AppLink.jsx";
import SiteSearchPanel from "../src/components/SiteSearchPanel.jsx";
import { LanguageProvider } from "../src/context/LanguageContext.jsx";
import { PreludeMotionProvider } from "../src/context/MotionContext.jsx";
import { useViewportActivity } from "../src/lib/motion/useViewportActivity.js";

let root;
let host;
let observers;

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    observers.push(this);
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }
}

function render(element) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(element));
}

function ActivityHarness() {
  const ref = useRef(null);
  const { active } = useViewportActivity(ref);
  return <div ref={ref} data-testid="activity" data-active={active ? "true" : "false"} />;
}

describe("landing behavior", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    observers = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("matchMedia", (query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));
    window.scrollTo = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(window, "sessionStorage", { configurable: true, value: storage });
    Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState({}, "", "/");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("cleans a landing hash and scrolls exactly once for top navigation", () => {
    window.history.replaceState({}, "", "/#pricing");
    render(
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <AppLink href="/">About</AppLink>
      </BrowserRouter>
    );

    act(() => host.querySelector("a").dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })));

    expect(window.location.pathname + window.location.hash).toBe("/");
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
  });

  it("does not intercept modified landing clicks", () => {
    render(
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <AppLink href="#pricing">Pricing</AppLink>
      </BrowserRouter>
    );
    const event = new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true });
    act(() => host.querySelector("a").dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
  });

  it("renders translated search results, navigates once, and dismisses the panel", () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <LanguageProvider>
          <SiteSearchPanel open onClose={onClose} triggerRef={{ current: null }} />
        </LanguageProvider>
      </BrowserRouter>
    );

    const input = host.querySelector("input");
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "pricing");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const result = host.querySelector(".site-search__result-btn");
    expect(result?.textContent).toContain("Pricing");
    act(() => result.click());
    expect(window.location.hash).toBe("#pricing");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pauses on visibility loss and disconnects every observer under Strict Mode", () => {
    render(
      <StrictMode>
        <PreludeMotionProvider>
          <ActivityHarness />
        </PreludeMotionProvider>
      </StrictMode>
    );

    const currentObserver = observers.at(-1);
    act(() => currentObserver.callback([{ isIntersecting: true }]));
    expect(host.querySelector("[data-testid=activity]").dataset.active).toBe("true");

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(host.querySelector("[data-testid=activity]").dataset.active).toBe("false");

    act(() => root.unmount());
    root = null;
    expect(observers.length).toBeGreaterThan(1);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });
});
