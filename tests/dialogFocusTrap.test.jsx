// @vitest-environment happy-dom
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogFocusTrap } from "../src/lib/useDialogFocusTrap.js";

let host;
let root;
let animationFrames;

function Harness() {
  const [open, setOpen] = useState(false);
  const dialogRef = useDialogFocusTrap(open, () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      {open ? (
        <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </div>
      ) : null}
    </>
  );
}

describe("useDialogFocusTrap", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    animationFrames = [];
    vi.stubGlobal("requestAnimationFrame", (callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    document.body.style.overflow = "";
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("traps focus, closes on Escape, restores focus, and unlocks scrolling", () => {
    const trigger = host.querySelector("button");
    trigger.focus();
    act(() => trigger.click());
    act(() => animationFrames.splice(0).forEach((callback) => callback()));

    const dialog = host.querySelector('[role="dialog"]');
    const buttons = dialog.querySelectorAll("button");
    expect(document.activeElement).toBe(buttons[0]);
    expect(document.body.style.overflow).toBe("hidden");

    buttons[1].focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);

    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(escape));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });
});
