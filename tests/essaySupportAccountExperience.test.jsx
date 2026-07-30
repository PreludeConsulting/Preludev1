import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EssaySupportCreditsSummary, {
  getEssaySupportCreditSummary
} from "../src/components/EssaySupportCreditsSummary.jsx";
import { getCurrentProductLabel, getCurrentProductName } from "../src/lib/currentProduct.js";
import { getMonthlyApplicationReviewLimit } from "../src/lib/planFeatures.js";

describe("Essay Support account experience", () => {
  it("replaces Basic on current-product labels", () => {
    expect(getCurrentProductName("basic", "Basic")).toBe("Essay Support");
    expect(getCurrentProductLabel("basic", "Basic")).toBe("Essay Support");
    expect(getCurrentProductLabel("plus", "Plus")).toBe("Plus plan");
  });

  it("derives purchased, assigned, and remaining credits from billing packages", () => {
    expect(
      getEssaySupportCreditSummary({
        packages: [
          {
            bundleId: "essay_support",
            sessionsPurchased: 6,
            sessionsRemaining: 4
          },
          {
            bundleId: "flexible_sessions",
            sessionsPurchased: 10,
            sessionsRemaining: 10
          }
        ]
      })
    ).toEqual({ purchased: 6, assigned: 2, remaining: 4 });
  });

  it("renders one-time credit copy without subscription language", () => {
    const markup = renderToStaticMarkup(
      <EssaySupportCreditsSummary
        reviewCredits={{ purchased: 10, assigned: 3, remaining: 7 }}
      />
    );

    expect(markup).toContain("Essay Support");
    expect(markup).toContain("One-time payment");
    expect(markup).toContain("Credits purchased");
    expect(markup).toContain("supplemental essays for one college");
    expect(markup).not.toMatch(/renew|cancel|monthly/i);
  });

  it("does not grant Basic monthly review credits", () => {
    expect(getMonthlyApplicationReviewLimit("basic")).toBe(0);
  });
});
