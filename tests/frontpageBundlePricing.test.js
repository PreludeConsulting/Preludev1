import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportBundleCard } from "../src/components/SupportBundlesSection.jsx";

const labels = {
  bestValue: "Best Value",
  oneTimePayment: "One-time Payment",
  popularOptions: "Popular options"
};

function renderCard(id, title, options) {
  return renderToStaticMarkup(
    createElement(SupportBundleCard, {
      card: {
        id,
        title,
        description: "Description",
        options,
        summary: "Summary",
        ctaLabel: "Customize",
        note: "Choose before checkout"
      },
      labels,
      onCustomize: () => {}
    })
  );
}

describe("front-page bundle pricing", () => {
  it("shows exact Essay Support prices next to the popular options", () => {
    const markup = renderCard("essay_support", "Essay Support", [
      "3 essay reviews",
      "6 essay reviews",
      "10 essay reviews"
    ]);
    expect(markup).toContain("Essay Support");
    expect(markup).toContain("$149");
    expect(markup).toContain("$265");
    expect(markup).toContain("$399");
    expect(markup).not.toContain("Starting at ");
  });

  it("shows exact Flexible Sessions prices next to the popular options", () => {
    const markup = renderCard("flexible_sessions", "Flexible Sessions", [
      "3 sessions",
      "6 sessions",
      "10 sessions"
    ]);
    expect(markup).toContain("Flexible Sessions");
    expect(markup).toContain("$219");
    expect(markup).toContain("$399");
    expect(markup).toContain("$629");
    expect(markup).not.toContain("Starting at ");
  });
});
