import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportBundleCard } from "../src/components/SupportBundlesSection.jsx";
import { BUNDLE_IDS, quoteBundleSelection, SUPPORT_BUNDLES } from "../shared/supportBundles.js";
import { getPricingPlans, PURCHASABLE_PLAN_IDS } from "../src/lib/plans.js";
import { getMonthlyApplicationReviewLimit } from "../src/lib/planFeatures.js";
import { getMonthlyOneOnOneLimit } from "../shared/mentorAccess.js";

const labels = {
  bestValue: "Best Value",
  oneTimePayment: "One-time Payment",
  popularOptions: "Popular options"
};

function renderCard(id, title, options, extras = {}) {
  return renderToStaticMarkup(
    createElement(SupportBundleCard, {
      card: {
        id,
        title,
        description: "Description",
        options,
        ctaLabel: "Customize",
        note: "Choose before checkout",
        ...extras
      },
      labels,
      onCustomize: () => {}
    })
  );
}

describe("front-page bundle pricing", () => {
  it("shows Essay Support popular options with exact prices", () => {
    const markup = renderCard(
      "essay_support",
      "Essay Support",
      ["3 essay reviews", "6 essay reviews", "10 essay reviews"],
      {
        summary: "Personal statements, supplemental essays, revisions, and final edits."
      }
    );
    expect(markup).toContain("Essay Support");
    expect(markup).toContain("3 essay reviews");
    expect(markup).toContain("Personal statements, supplemental essays, revisions, and final edits.");
    expect(markup).toContain("$149");
    expect(markup).toContain("$265");
    expect(markup).toContain("$399");
    expect(markup).not.toContain("Starting at ");
  });

  it("does not sell Flexible Sessions as a one-time bundle", () => {
    expect(BUNDLE_IDS).toEqual(["essay_support"]);
    expect(SUPPORT_BUNDLES.flexible_sessions).toBeUndefined();
    const quote = quoteBundleSelection({
      bundleId: "flexible_sessions",
      quantities: { sessions: 3 }
    });
    expect(quote.ok).toBe(false);
  });
});

describe("purchasable pricing catalog", () => {
  it("offers only Plus and Pro as monthly plans", () => {
    expect(PURCHASABLE_PLAN_IDS).toEqual(["plus", "pro"]);
    expect(getPricingPlans().map((plan) => plan.id)).toEqual(["plus", "pro"]);
  });

  it("grants live sessions on Plus/Pro and no monthly async review credits", () => {
    expect(getMonthlyOneOnOneLimit("plus")).toBe(2);
    expect(getMonthlyOneOnOneLimit("pro")).toBe(4);
    expect(getMonthlyApplicationReviewLimit("plus")).toBe(0);
    expect(getMonthlyApplicationReviewLimit("pro")).toBe(0);
    expect(getMonthlyApplicationReviewLimit("basic")).toBe(2);
  });

  it("quotes Essay Support as a one-time purchase", () => {
    const quote = quoteBundleSelection({
      bundleId: "essay_support",
      quantities: { essayReviews: 6 }
    });
    expect(quote.ok).toBe(true);
    expect(quote.purchaseType).toBe("one_time_bundle");
    expect(quote.totalCents).toBe(26500);
  });
});
