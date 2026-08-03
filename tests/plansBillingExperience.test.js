/**
 * Plans & Billing UX — Manage billing portal, plan-selection routes, Payment Links.
 */
import { describe, it, expect, vi } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_REVIEW_CREDITS,
  ESSAY_SUPPORT_OPTIONS,
  STRIPE_CUSTOMER_PORTAL_URL,
  STUDENT_BILLING_PATH,
  STUDENT_BILLING_PLANS_PATH,
  SUBSCRIPTION_PAYMENT_LINKS,
  buildStudentBillingPlansPath,
  buildStripePaymentLinkUrl,
  openStripeCustomerPortal,
  resolvePurchaseFromPaymentLinkId
} from "../shared/stripePaymentLinks.js";
import { buildEssaySupportPath, getMonthlyOneOnOneLimit } from "../shared/mentorAccess.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("BillingMembershipPanel actions", () => {
  it("replaces Cancel membership and Update payment method with Manage billing", () => {
    const source = readFileSync(
      join(__dirname, "../src/dashboard/components/settings/BillingMembershipPanel.jsx"),
      "utf8"
    );
    expect(source).toContain("Manage billing");
    expect(source).toContain("openStripeCustomerPortal");
    expect(source).not.toMatch(/Cancel membership/);
    expect(source).not.toMatch(/Update payment method/);
    expect(source).toContain("STUDENT_BILLING_PLANS_PATH");
    expect(source).toContain("Purchase Essay Support");
    expect(source).toContain("View plans");
    expect(source).toContain("Refresh");
  });
});

describe("StudentBillingPlansPage back link", () => {
  it("links back to Plans and Billing", () => {
    const source = readFileSync(
      join(__dirname, "../src/dashboard/components/product/StudentBillingPlansPage.jsx"),
      "utf8"
    );
    expect(source).toContain("Back to Plans and Billing");
    expect(source).toContain("STUDENT_BILLING_PATH");
    expect(source).toContain('context="dashboard"');
  });
});

describe("Dashboard plan switch avoids Payment Link for active subscribers", () => {
  it("uses changeMembershipPlan for Plus↔Pro switches", () => {
    const source = readFileSync(join(__dirname, "../src/components/PlanSelectionPage.jsx"), "utf8");
    expect(source).toContain("handleChooseDashboard");
    expect(source).toContain("changeMembershipPlan");
    expect(source).toContain("activePaidPlanId");
    expect(source).toMatch(/never open a second Payment Link/);
  });
});

describe("Stripe Customer Portal", () => {
  it("uses the exact hosted portal login URL", () => {
    expect(STRIPE_CUSTOMER_PORTAL_URL).toBe(
      "https://billing.stripe.com/p/login/9B69AT0Kec3a6MX5cy9Zm00"
    );
  });

  it("openStripeCustomerPortal assigns the portal URL", () => {
    const assign = vi.fn();
    const previous = globalThis.window;
    globalThis.window = { location: { assign } };
    openStripeCustomerPortal();
    expect(assign).toHaveBeenCalledWith(STRIPE_CUSTOMER_PORTAL_URL);
    globalThis.window = previous;
  });
});

describe("Student billing routes", () => {
  it("View plans uses dedicated logged-in plans route", () => {
    expect(STUDENT_BILLING_PLANS_PATH).toBe("/dashboard/student/billing/plans");
    expect(STUDENT_BILLING_PATH).toBe("/dashboard/student/billing");
  });

  it("Back link destination is Plans and Billing", () => {
    expect(STUDENT_BILLING_PATH).toBe("/dashboard/student/billing");
  });

  it("Purchase Essay Support focuses essay support on plans page", () => {
    expect(buildEssaySupportPath()).toContain("/dashboard/student/billing/plans");
    expect(buildEssaySupportPath()).toContain("selection=essay-support");
    expect(buildStudentBillingPlansPath({ selection: "essay-support" })).toContain(
      "bundle=essay_support"
    );
  });
});

describe("Essay Support Payment Link catalog", () => {
  it("allows exactly 3,4,5,6,7,8,10 and never 9", () => {
    expect([...ALLOWED_REVIEW_CREDITS]).toEqual([3, 4, 5, 6, 7, 8, 10]);
    expect(ALLOWED_REVIEW_CREDITS.includes(9)).toBe(false);
  });

  it("maps every quantity to the correct price and Payment Link", () => {
    const expected = {
      3: { price: 149, id: "plink_1U07jWGRpwYd0PZQ0ZcxaoMJ", url: "https://buy.stripe.com/00w5kD1Oi8QYb3dawS9Zm02" },
      4: { price: 189, id: "plink_1U07jxGRpwYd0PZQeQmfDlZJ", url: "https://buy.stripe.com/aFa3cvakOd7e5IT8oK9Zm05" },
      5: { price: 229, id: "plink_1U07jnGRpwYd0PZQV2FfqKht", url: "https://buy.stripe.com/3cI3cv50uc3a3AL8oK9Zm04" },
      6: { price: 265, id: "plink_1U07jfGRpwYd0PZQEDH0Fg21", url: "https://buy.stripe.com/8x2cN5csW5EM9Z934q9Zm03" },
      7: { price: 299, id: "plink_1U07k5GRpwYd0PZQXZaFZK9I", url: "https://buy.stripe.com/eVq8wP64yebi3ALcF09Zm06" },
      8: { price: 329, id: "plink_1U07kHGRpwYd0PZQCGaJXVyJ", url: "https://buy.stripe.com/4gMaEX3Wq8QY6MX8oK9Zm08" },
      10: { price: 399, id: "plink_1U07kCGRpwYd0PZQhKObWibu", url: "https://buy.stripe.com/aFa14neB4aZ62wHcF09Zm07" }
    };
    for (const credits of ALLOWED_REVIEW_CREDITS) {
      const option = ESSAY_SUPPORT_OPTIONS[credits];
      expect(option.price).toBe(expected[credits].price);
      expect(option.paymentLinkId).toBe(expected[credits].id);
      expect(option.url).toBe(expected[credits].url);
      expect(resolvePurchaseFromPaymentLinkId(option.paymentLinkId).credits).toBe(credits);
    }
  });
});

describe("Subscription Payment Links", () => {
  it("Plus and Pro links match production IDs", () => {
    expect(SUBSCRIPTION_PAYMENT_LINKS.plus).toEqual({
      price: 149.99,
      paymentLinkId: "plink_1U07ivGRpwYd0PZQFhZs1ERC",
      url: "https://buy.stripe.com/cNi28r78C8QY2wHawS9Zm01"
    });
    expect(SUBSCRIPTION_PAYMENT_LINKS.pro).toEqual({
      price: 249.99,
      paymentLinkId: "plink_1U07i3GRpwYd0PZQn4S9M98R",
      url: "https://buy.stripe.com/9B69AT0Kec3a6MX5cy9Zm00"
    });
  });

  it("new subscription checkout includes client_reference_id and locked_prefilled_email", () => {
    const url = new URL(
      buildStripePaymentLinkUrl(SUBSCRIPTION_PAYMENT_LINKS.plus.url, {
        userId: "user-abc",
        email: "student@example.com"
      })
    );
    expect(url.searchParams.get("client_reference_id")).toBe("user-abc");
    expect(url.searchParams.get("locked_prefilled_email")).toBe("student@example.com");
  });
});

describe("Plan entitlements", () => {
  it("preserves Plus 2 / Pro 4 session allowances", () => {
    assert.equal(getMonthlyOneOnOneLimit("plus"), 2);
    assert.equal(getMonthlyOneOnOneLimit("pro"), 4);
  });
});
