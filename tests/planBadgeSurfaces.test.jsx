// @vitest-environment happy-dom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingCard from "../src/components/PricingCard.jsx";
import {
  PlanDetailsPanel,
  PlanWalletExperience,
  PlanPopup,
  WalletPlanCard
} from "../src/components/PlanSelectionPage.jsx";
import { AuthContext } from "../src/context/AuthContext.jsx";
import { LanguageProvider } from "../src/context/LanguageContext.jsx";
import BillingCurrentPlanCard from "../src/dashboard/components/product/billing/BillingCurrentPlanCard.jsx";
import BillingMembershipPanel from "../src/dashboard/components/settings/BillingMembershipPanel.jsx";
import { getPlan } from "../src/lib/plans.js";
import { translations } from "../src/lib/translations.js";

const billingApi = vi.hoisted(() => ({
  cancelMembership: vi.fn(),
  fetchBillingHistory: vi.fn(),
  fetchBillingSummary: vi.fn(),
  reactivateMembership: vi.fn()
}));

vi.mock("../src/lib/billingMembership.js", () => billingApi);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let roots = [];

function mount(element) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  act(() => root.render(element));
  return host;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
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
  window.localStorage.clear();
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  billingApi.fetchBillingSummary.mockReset();
  billingApi.fetchBillingHistory.mockReset();
});

afterEach(() => {
  for (const { root, host } of roots) {
    act(() => root.unmount());
    host.remove();
  }
  roots = [];
  vi.restoreAllMocks();
});

function renderPricing(planId, language) {
  return renderToStaticMarkup(
    <PricingCard
      plan={getPlan(planId)}
      language={language}
      onSelect={() => {}}
      loading={false}
      startFreeLabel="Choose Basic"
      chooseLabel="Choose {{plan}}"
      pleaseWaitLabel="Please wait..."
    />
  );
}

function renderWallet(planId, language) {
  return renderToStaticMarkup(
    <WalletPlanCard
      plan={getPlan(planId)}
      language={language}
      index={0}
      selected={false}
      selectable
      onSelect={() => {}}
    />
  );
}

function renderDetails(planId, language) {
  return renderToStaticMarkup(
    <PlanDetailsPanel plan={getPlan(planId)} language={language} />
  );
}

function renderPopup(planId, language) {
  return renderToStaticMarkup(
    <PlanPopup
      plan={getPlan(planId)}
      language={language}
      status="popup-open"
      busy={false}
      notice=""
      onSelectPlan={() => {}}
      onViewOtherPlans={() => {}}
      onRequestClose={() => {}}
    />
  );
}

function renderBilling(planId) {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <LanguageProvider>
        <BillingCurrentPlanCard plan={getPlan(planId)} />
      </LanguageProvider>
    </StaticRouter>
  );
}

describe("localized plan badges across presentation surfaces", () => {
  it("renders the shared badge labels on landing pricing cards", () => {
    expect(renderPricing("plus", "en")).toContain("Most Popular");
    expect(renderPricing("pro", "en")).toContain("Best Value");
    expect(renderPricing("basic", "en")).not.toMatch(/Most Popular|Best Value/);
  });

  it("keeps featured styling independent from badge eligibility", () => {
    const plus = renderPricing("plus", "en");
    const pro = renderPricing("pro", "en");

    expect(plus).toContain('class="pricing-card ');
    expect(plus).not.toContain("pricing-card--featured");
    expect(pro).toContain("pricing-card pricing-card--featured");
    expect(pro).toContain("pricing-card__badge");
  });

  it("localizes wallet cards and preserves their styling hooks", () => {
    const plus = renderWallet("plus", "ko");
    const pro = renderWallet("pro", "zh");

    expect(plus).toContain("가장 인기");
    expect(plus).toContain("pw-card pw-card--plus");
    expect(pro).toContain("超值之选");
    expect(pro).toContain("pw-card__badge");
  });

  it("threads the stored language preference through the real public plans wallet", () => {
    window.localStorage.setItem("prelude-language", "ko");

    const markup = renderToStaticMarkup(
      <StaticRouter location="/plans">
        <LanguageProvider>
          <AuthContext.Provider
            value={{
              isAuthenticated: false,
              openRegister: () => {},
              refreshUser: async () => {},
              saveUserPlan: async () => {}
            }}
          >
            <PlanWalletExperience
              context="public"
              user={null}
              persistState={false}
            />
          </AuthContext.Provider>
        </LanguageProvider>
      </StaticRouter>
    );

    expect(markup).toContain("pw-wallet");
    expect(markup).toContain("pw-card__badge");
    expect(markup).toContain("가장 인기");
    expect(markup).toContain("최고의 가치");
    expect(markup).not.toContain("Most Popular");
  });

  it("localizes inline details and modal popups without changing popup classes", () => {
    const details = renderDetails("plus", "es");
    const popup = renderPopup("pro", "ko");

    expect(details).toContain("Más popular");
    expect(details).toContain("pw-popup pw-popup--plus pw-popup--inline");
    expect(popup).toContain("최고의 가치");
    expect(popup).toContain("pw-popup pw-popup--pro");
    expect(popup).toContain("pw-popup__badge");
  });

  it("uses the shared badge label in dashboard billing and preserves both badge classes", () => {
    const billing = renderBilling("pro");

    expect(billing).toContain("Best Value");
    expect(billing).toContain("billing-current-plan billing-current-plan--pro");
    expect(billing).toContain("billing-current-plan__badge--active");
    expect(billing).toContain("billing-current-plan__badge--popular");
    expect(billing).toContain("billing-current-plan__badge-icon");
  });

  it("renders the localized badge in the live dashboard billing panel", async () => {
    window.localStorage.setItem("prelude-language", "zh");
    billingApi.fetchBillingSummary.mockResolvedValue({
      eligible: true,
      canManage: true,
      householdId: "household-1",
      viewerRole: "student",
      subscriberUserId: "student-1",
      plan: {
        id: "pro",
        name: "Pro",
        priceCents: 24999,
        priceLabel: "$249.99",
        interval: "month",
        currency: "usd"
      },
      membership: {
        key: "active",
        label: "Active",
        autoRenew: true,
        renewsAt: null,
        endsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        subscriptionStatus: "active",
        cancelAtPeriodEnd: false,
        canceledAt: null,
        stripeSubscriptionId: "sub_123",
        hasCustomer: true,
        explanation: "Your Pro membership is active.",
        actions: {
          cancel: false,
          reactivate: false,
          purchaseMembership: false,
          purchaseSessions: false,
          managePaymentMethod: false
        }
      },
      sessions: { available: 0, packages: [] },
      mentorAccess: {
        allowed: true,
        accessType: "subscription",
        remainingSessions: 0,
        reason: "active_membership"
      }
    });
    billingApi.fetchBillingHistory.mockResolvedValue({
      eligible: true,
      purchases: [],
      total: 0,
      limit: 10,
      offset: 0,
      hasMore: false
    });

    const host = mount(
      <StaticRouter location="/dashboard/student/billing">
        <LanguageProvider>
          <BillingMembershipPanel />
        </LanguageProvider>
      </StaticRouter>
    );
    await flushEffects();

    expect(host.textContent).toContain("Pro plan");
    expect(host.textContent).toContain("Active");
    expect(host.textContent).toContain("超值之选");
    const badge = host.querySelector(".dash-billing-membership__plan-badge");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("dash-badge--lavender");
    expect(badge.querySelector(".dash-billing-membership__plan-badge-icon")).toBeTruthy();
    const statusBadge = [...host.querySelectorAll(".dash-badge")].find(
      (node) => node.textContent === "Active"
    );
    expect(statusBadge).toBeTruthy();
    expect(statusBadge.className).toContain("dash-badge--soft");
  });
});

describe("obsolete subscription badge translations", () => {
  it("removes plan badge keys while retaining bundle badge copy in every locale", () => {
    for (const locale of Object.values(translations)) {
      expect(locale.sections.plans).not.toHaveProperty("mostPopular");
      expect(locale.sections.plans).not.toHaveProperty("bestValue");
      expect(locale.sections.bundles.bestValue).toBeTruthy();
      expect(locale.sections.bundles.popularOptions).toBeTruthy();
    }
  });
});
