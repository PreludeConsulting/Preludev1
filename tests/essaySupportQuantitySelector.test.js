import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuantityControl } from "../src/components/BundleCustomizePopup.jsx";
import {
  APPROVED_CREDIT_OPTIONS,
  BUNDLE_QUANTITY_OPTIONS,
  canStepApprovedQuantity,
  essayPackageKey,
  ESSAY_SUPPORT_PRICE_CENTS,
  formatUsd,
  normalizeBundleSelection,
  quoteBundleSelection,
  stepApprovedQuantity
} from "../shared/supportBundles.js";

describe("essay support quantity packages", () => {
  it("exposes the approved credit sequence without 9", () => {
    expect(BUNDLE_QUANTITY_OPTIONS).toEqual([3, 4, 5, 6, 7, 8, 10]);
    expect(APPROVED_CREDIT_OPTIONS).toEqual(BUNDLE_QUANTITY_OPTIONS);
    expect(BUNDLE_QUANTITY_OPTIONS).not.toContain(9);
    expect(BUNDLE_QUANTITY_OPTIONS).not.toContain(1);
    expect(BUNDLE_QUANTITY_OPTIONS).not.toContain(2);
  });

  it("steps forward through every approved package and skips 9", () => {
    let qty = 3;
    const path = [qty];
    while (canStepApprovedQuantity(qty, 1)) {
      qty = stepApprovedQuantity(qty, 1);
      path.push(qty);
    }
    expect(path).toEqual([3, 4, 5, 6, 7, 8, 10]);
    expect(canStepApprovedQuantity(10, 1)).toBe(false);
    expect(stepApprovedQuantity(10, 1)).toBe(10);
  });

  it("steps backward through every approved package and skips 9", () => {
    let qty = 10;
    const path = [qty];
    while (canStepApprovedQuantity(qty, -1)) {
      qty = stepApprovedQuantity(qty, -1);
      path.push(qty);
    }
    expect(path).toEqual([10, 8, 7, 6, 5, 4, 3]);
    expect(canStepApprovedQuantity(3, -1)).toBe(false);
    expect(stepApprovedQuantity(3, -1)).toBe(3);
  });

  it("resets invalid saved quantities to 3 when snapping for UI", () => {
    const normalized = normalizeBundleSelection(
      { bundleId: "essay_support", quantities: { essayReviews: 9 } },
      { snapInvalidQuantities: true }
    );
    expect(normalized.ok).toBe(true);
    expect(normalized.selection.quantities.essayReviews).toBe(3);
  });

  it("quotes the mapped package price and badge for every quantity", () => {
    for (const qty of BUNDLE_QUANTITY_OPTIONS) {
      const quote = quoteBundleSelection({
        bundleId: "essay_support",
        quantities: { essayReviews: qty }
      });
      expect(quote.ok).toBe(true);
      expect(quote.totalCents).toBe(ESSAY_SUPPORT_PRICE_CENTS[qty]);
      expect(quote.displayTotal).toBe(formatUsd(ESSAY_SUPPORT_PRICE_CENTS[qty]));
      expect(quote.summaryLines[0]).toBe(`${qty} review credits`);
      expect(essayPackageKey(qty)).toBe(`essay_support_${qty}`);
    }
  });

  it("disables QuantityControl ends at 3 and 10", () => {
    const atMin = renderToStaticMarkup(
      createElement(QuantityControl, {
        label: "Review credits",
        value: 3,
        allowed: BUNDLE_QUANTITY_OPTIONS,
        onChange: () => {}
      })
    );
    expect(atMin).toContain('aria-label="Decrease Review credits" disabled');
    expect(atMin).toContain('aria-label="Increase Review credits"');
    expect(atMin).not.toContain('aria-label="Increase Review credits" disabled');

    const atMax = renderToStaticMarkup(
      createElement(QuantityControl, {
        label: "Review credits",
        value: 10,
        allowed: BUNDLE_QUANTITY_OPTIONS,
        onChange: () => {}
      })
    );
    expect(atMax).toContain('aria-label="Increase Review credits" disabled');
    expect(atMax).not.toContain('aria-label="Decrease Review credits" disabled');
  });
});
