import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportBundleCard } from "../src/components/SupportBundlesSection.jsx";

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
  it("shows exact Essay Support prices next to the popular options", () => {
    const markup = renderCard(
      "essay_support",
      "Application & Essay Support",
      ["3 review credits", "6 review credits", "10 review credits"],
      {
        infoTitle: "What counts as 1 review credit?",
        infoPoints: [
          "One personal statement",
          "Or the full set of supplemental essays for one college"
        ]
      }
    );
    expect(markup).toContain("Application &amp; Essay Support");
    expect(markup).toContain("3 review credits");
    expect(markup).toContain("What counts as 1 review credit?");
    expect(markup).toContain("One personal statement");
    expect(markup).toContain("$149");
    expect(markup).toContain("$265");
    expect(markup).toContain("$399");
    expect(markup).not.toContain("Starting at ");
  });

  it("shows exact Flexible Sessions prices next to the popular options", () => {
    const markup = renderCard(
      "flexible_sessions",
      "Flexible Sessions",
      ["3 sessions", "6 sessions", "10 sessions"],
      {
        infoTitle: "What counts as 1 session?",
        infoPoints: ["A private meeting with a Prelude mentor", "College admissions guidance"]
      }
    );
    expect(markup).toContain("Flexible Sessions");
    expect(markup).toContain("What counts as 1 session?");
    expect(markup).toContain("A private meeting with a Prelude mentor");
    expect(markup).toContain("$219");
    expect(markup).toContain("$399");
    expect(markup).toContain("$629");
    expect(markup).not.toContain("Starting at ");
  });
});
