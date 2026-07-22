// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MembershipDrawer from "../src/components/MembershipDrawer.jsx";
import { AuthContext } from "../src/context/AuthContext.jsx";
import StudentApplicationReviewsPanel from "../src/dashboard/components/product/StudentApplicationReviewsPanel.jsx";
import { navigateChatHref } from "../src/lib/chatLinkSecurity.js";
import { getPlan } from "../src/lib/plans.js";

let host;
let root;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.hash}</output>;
}

function render(element) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(element));
}

function renderMembershipDrawer(closeModals = vi.fn()) {
  render(
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <AuthContext.Provider
        value={{
          accountOpen: true,
          closeModals,
          user: {
            id: "student-1",
            name: "Prelude Student",
            email: "student@example.com",
            role: "student",
            plan: "plus"
          },
          planDetails: getPlan("plus"),
          signOut: vi.fn()
        }}
      >
        <MembershipDrawer />
        <LocationProbe />
      </AuthContext.Provider>
    </BrowserRouter>
  );
  return closeModals;
}

describe("frontend production-readiness regressions", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));
    window.history.replaceState({}, "", "/contact");
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.unstubAllGlobals();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("uses router navigation for chat hash and app actions", () => {
    const navigate = vi.fn();

    expect(navigateChatHref("#pricing", { navigate, pathname: "/contact" })).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/#pricing", { state: { landingScroll: true } });

    navigate.mockClear();
    expect(navigateChatHref("/dashboard/student", { navigate, pathname: "/contact" })).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/dashboard/student");
  });

  it("routes the membership upgrade action to landing pricing from another page", () => {
    const closeModals = renderMembershipDrawer();
    const upgrade = Array.from(host.querySelectorAll("a, button")).find((node) =>
      node.textContent.includes("View or Upgrade Plan")
    );

    act(() => upgrade.click());

    expect(host.querySelector('[data-testid="location"]').textContent).toBe("/#pricing");
    expect(closeModals).toHaveBeenCalledTimes(1);
  });

  it("routes account settings to the signed-in user's settings page", () => {
    const closeModals = renderMembershipDrawer();
    const settings = Array.from(host.querySelectorAll("a, button")).find((node) =>
      node.textContent.includes("Account settings")
    );

    act(() => settings.click());

    expect(host.querySelector('[data-testid="location"]').textContent).toBe("/dashboard/student/settings");
    expect(closeModals).toHaveBeenCalledTimes(1);
  });

  it("shows an intentional application-review empty state instead of maintenance copy", () => {
    render(<StudentApplicationReviewsPanel />);

    expect(host.textContent).toContain("No application reviews yet");
    expect(host.textContent).toContain("Completed mentor reviews will appear here");
    expect(host.textContent).not.toMatch(/maintenance|done soon|coming soon/i);
  });

  it("wires every standalone dialog to the shared focus-trap hook", () => {
    const dialogFiles = [
      "src/components/SignInModal.jsx",
      "src/components/LegalModal.jsx",
      "src/components/mentors/MentorDetailModal.jsx",
      "src/components/MembershipDrawer.jsx",
      "src/dashboard/components/MeetingDetailModal.jsx",
      "src/dashboard/components/product/rewards/RewardRedeemModal.jsx"
    ];

    for (const file of dialogFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("useDialogFocusTrap");
      expect(source, file).toContain("ref={dialogRef}");
      expect(source, file).toMatch(/tabIndex=\{-1\}/);
    }
  });
});
