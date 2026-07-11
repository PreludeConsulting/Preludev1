// @vitest-environment happy-dom
import React, { useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthLayout from "../src/components/auth/AuthLayout.jsx";
import { AuthSubmitButton, normalizeOtpDigits, OtpInput } from "../src/components/auth/AuthForm.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let roots = [];

function mount(element) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  act(() => {
    root.render(element);
  });
  return host;
}

function Harness({ error = "", onComplete = () => {} }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  return React.createElement(OtpInput, { value: digits, onChange: setDigits, error, onComplete });
}

function input(element, value) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(element, keyName) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true }));
  });
}

async function flushFocus() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}

afterEach(() => {
  for (const { root, host } of roots) {
    act(() => root.unmount());
    host.remove();
  }
  roots = [];
  vi.restoreAllMocks();
});

describe("OtpInput", () => {
  it("normalizes copied codes without exposing non-numeric characters", () => {
    expect(normalizeOtpDigits(" 12 3-4a56 ")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(normalizeOtpDigits("98")).toEqual(["9", "8", "", "", "", ""]);
  });

  it("renders six accessible digit inputs with one-time-code support", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AuthLayout,
          { title: "Check your email", subtitle: "We sent a 6-digit code." },
          React.createElement(OtpInput, {
            value: ["", "", "", "", "", ""],
            onChange: () => {},
            error: "That code is incorrect."
          }),
          React.createElement(AuthSubmitButton, null, "Verify email")
        )
      )
    );

    expect(html).toContain("auth-shell");
    expect(html).toContain("Check your email");
    expect(html).toContain("Verification code digit 1");
    expect(html).toContain("autoComplete=\"one-time-code\"");
    expect(html).toContain("inputMode=\"numeric\"");
    expect(html).toContain("That code is incorrect.");
    expect(html).toContain("Verify email");
  });

  it("advances after a digit and supports arrow/backspace focus movement", async () => {
    const host = mount(React.createElement(Harness));
    const inputs = host.querySelectorAll(".auth-otp__input");

    inputs[0].focus();
    input(inputs[0], "4");
    await flushFocus();
    expect(inputs[0].value).toBe("4");
    expect(document.activeElement).toBe(inputs[1]);

    key(inputs[1], "ArrowLeft");
    await flushFocus();
    expect(document.activeElement).toBe(inputs[0]);

    inputs[2].focus();
    key(inputs[2], "Backspace");
    await flushFocus();
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("fills all digits from a pasted code with spaces", async () => {
    const onComplete = vi.fn();
    const host = mount(React.createElement(Harness, { onComplete }));
    const row = host.querySelector(".auth-otp__row");
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "12 34 56" }
    });

    act(() => {
      row.dispatchEvent(pasteEvent);
    });
    await flushFocus();

    const values = Array.from(host.querySelectorAll(".auth-otp__input")).map((node) => node.value);
    expect(values).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(onComplete).toHaveBeenCalledWith("123456");
    expect(document.activeElement).toBe(host.querySelectorAll(".auth-otp__input")[5]);
  });

  it("does not schedule forward focus after the sixth digit", async () => {
    const host = mount(React.createElement(Harness));
    const inputs = host.querySelectorAll(".auth-otp__input");
    const raf = vi.spyOn(window, "requestAnimationFrame");

    inputs[5].focus();
    input(inputs[5], "6");

    expect(raf).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(inputs[5]);
  });

  it("cancels queued focus when the OTP fields unmount", () => {
    const host = mount(React.createElement(Harness));
    const inputs = host.querySelectorAll(".auth-otp__input");
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    input(inputs[0], "4");
    const mounted = roots.pop();
    act(() => mounted.root.unmount());
    mounted.host.remove();

    expect(cancel).toHaveBeenCalled();
  });
});
