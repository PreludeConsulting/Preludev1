import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSubscriptionEntitlement } from "../shared/billingMembership.js";
import { isCheckoutPaymentSuccessful } from "../shared/stripePaymentLinks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

describe("post-payment redirect to student overview", () => {
  it("CheckoutSuccessPage auto-navigates to the student overview after confirm", () => {
    const source = read("src/components/BillingResultPage.jsx");
    expect(source).toContain('status === "confirmed"');
    expect(source).toContain("Navigate to={STUDENT_OVERVIEW_PATH}");
    expect(source).toContain("confirmOnboardingCheckoutSession");
    expect(source).toContain("no_payment_required");
    expect(source).not.toMatch(/status === "timeout"[\s\S]{0,200}Navigate to=\{PAYMENT_ONBOARDING_PATH\}/);
  });

  it("Checkout Session success URLs keep session_id for confirm-session", () => {
    const node = read("server/billingApi.js");
    const cf = read("functions/_lib/stripeBilling.js");
    expect(node).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(cf).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(node).toContain("/checkout/success?");
    expect(cf).toContain("/checkout/success?");
  });

  it("Cloudflare confirm-session fulfills Essay Support like the Node path", () => {
    const cf = read("functions/_lib/stripeBilling.js");
    expect(cf).toContain("handleBillingConfirmSession");
    expect(cf).toContain("fulfillEssaySupportCheckout");
    expect(cf).toContain("expand[]=payment_link");
    expect(cf).toContain("isCheckoutPaymentSuccessful");
  });

  it("membership guard allows Essay Support buyers onto the dashboard", () => {
    const guard = read("src/components/RequireActiveMembershipGuard.jsx");
    expect(guard).toContain("essaySupportAccess");
    expect(guard).toContain("dashboardAccess");
    expect(guard).toContain("paymentStepComplete");
  });

  it("RequirePlanGuard confirms a Stripe session_id before bouncing to payment", () => {
    const guard = read("src/components/RequirePlanGuard.jsx");
    expect(guard).toContain("confirmOnboardingCheckoutSession");
    expect(guard).toContain("session_id");
  });
});

describe("zero-dollar checkout recognition", () => {
  it("treats paid and no_payment_required sessions as successful", () => {
    expect(isCheckoutPaymentSuccessful({ payment_status: "paid", amount_total: 0 })).toBe(true);
    expect(
      isCheckoutPaymentSuccessful({ payment_status: "no_payment_required", amount_total: 0 })
    ).toBe(true);
    expect(isCheckoutPaymentSuccessful({ payment_status: "unpaid", amount_total: 0 })).toBe(false);
  });

  it("marks essay-only purchases as dashboard-accessible", () => {
    const dto = buildSubscriptionEntitlement({
      planId: "basic",
      subscriptionStatus: null,
      essaySupportPurchased: 5,
      essaySupportRemaining: 5
    });
    expect(dto.isActive).toBe(false);
    expect(dto.essaySupportAccess).toBe(true);
    expect(dto.dashboardAccess).toBe(true);
    expect(dto.features.essaySupport).toBe(true);
  });
});
