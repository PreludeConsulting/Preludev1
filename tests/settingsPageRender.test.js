// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockAuth;
let mockDashboardData;

vi.mock("../src/context/AuthContext.jsx", () => ({
  useAuth: () => mockAuth
}));

vi.mock("../src/dashboard/context/DashboardDataContext.jsx", () => ({
  useDashboardData: () => mockDashboardData
}));

vi.mock("../src/lib/parentLinks.js", () => ({
  inviteParent: vi.fn(async () => ({ id: "invite-1" })),
  listParentInvites: vi.fn(async () => [])
}));

const { StudentSettingsPage } = await import("../src/dashboard/pages/shared/SettingsPages.jsx");

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

function clickByText(host, text) {
  const button = [...host.querySelectorAll("button")].find((node) => node.textContent.includes(text));
  expect(button, `button containing "${text}"`).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return button;
}

function setInputValue(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function installLocalStorageStub() {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => store.get(String(key)) ?? null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: (key) => store.delete(String(key)),
      clear: () => store.clear()
    }
  });
}

beforeEach(() => {
  installLocalStorageStub();
  window.location.hash = "";
  mockAuth = {
    user: {
      id: "student-1",
      name: "Jordan Lee",
      email: "jordan@example.com",
      role: "student",
      planName: "Core"
    },
    planDetails: { name: "Core" },
    openAccount: vi.fn()
  };
  mockDashboardData = {
    integrations: {
      googleCalendar: { connected: false },
      zoom: { connected: false }
    },
    connectGoogle: vi.fn(async () => {}),
    disconnectGoogle: vi.fn(async () => {}),
    connectZoomAccount: vi.fn(async () => {}),
    disconnectZoomAccount: vi.fn(async () => {}),
    savePreferences: vi.fn(async () => {}),
    saveProfile: vi.fn(async () => {}),
    useSupabaseData: false,
    preferences: null,
    profile: {
      fullName: "Jordan Lee",
      preferredName: "Jordan",
      school: "Northview High",
      graduationYear: "2027",
      grade: "11"
    }
  };
});

afterEach(() => {
  for (const { root, host } of roots) {
    act(() => root.unmount());
    host.remove();
  }
  roots = [];
  vi.restoreAllMocks();
});

describe("StudentSettingsPage", () => {
  it("renders the cleaner settings sections without theme clutter", () => {
    const host = mount(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(StudentSettingsPage)
      )
    );

    expect(host.textContent).toContain("Jordan Lee");
    expect(host.querySelectorAll(".dash-input").length).toBeGreaterThan(3);

    clickByText(host, "Notifications");
    expect(host.textContent).toContain("Essential notifications");
    expect(host.textContent).toContain("Student progress");
    expect(host.textContent).toContain("Quiet hours");
    expect(host.textContent).toContain("Product & account emails");
    expect(host.textContent).toContain("Security alerts");

    clickByText(host, "Display");
    expect(host.textContent).toContain("Display & accessibility");
    expect(host.textContent).toContain("Layout density");
    expect(host.textContent).toContain("Reduce motion");
    expect(host.textContent).not.toContain("Theme");

    clickByText(host, "Connected accounts");
    expect(host.textContent).toContain("Google Calendar");
    expect(host.textContent).toContain("Zoom");
    expect(host.textContent).toContain("Setup required");
    expect(host.textContent).toContain("Coming soon");

    clickByText(host, "Coming soon");
    expect(host.textContent).toContain("OAuth is not configured");
  });

  it("keeps the family invite input visible and validates bad email inline", async () => {
    const host = mount(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(StudentSettingsPage)
      )
    );

    clickByText(host, "Family");
    await flushEffects();

    const emailInput = host.querySelector('input[type="email"]');
    expect(emailInput).toBeTruthy();
    expect(host.textContent).toContain("Parent email");
    expect(clickByText(host, "Send invitation").disabled).toBe(true);

    setInputValue(emailInput, "not-an-email");
    act(() => {
      emailInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(emailInput.getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("Enter a valid parent or guardian email address.");
  });
});
