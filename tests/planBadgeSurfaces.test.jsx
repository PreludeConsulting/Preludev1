import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";
import { describe, expect, it } from "vitest";
import PricingCard from "../src/components/PricingCard.jsx";
import {
  PlanDetailsPanel,
  PlanPopup,
  WalletPlanCard
} from "../src/components/PlanSelectionPage.jsx";
import { LanguageProvider } from "../src/context/LanguageContext.jsx";
import BillingCurrentPlanCard from "../src/dashboard/components/product/billing/BillingCurrentPlanCard.jsx";
import { getPlan } from "../src/lib/plans.js";
import { translations } from "../src/lib/translations.js";

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
