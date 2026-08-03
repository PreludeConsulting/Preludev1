/**
 * Ensure plan-selection checkout never unlocks Plus/Pro before Stripe payment webhooks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

describe("No optimistic entitlement on checkout click", () => {
  it("dashboard Continue to checkout does not update plan_id or credits", () => {
    const source = read("src/components/PlanSelectionPage.jsx");
    const start = source.indexOf("async function handleChooseDashboard");
    const end = source.indexOf("async function handleChoosePublic", start);
    const body = source.slice(start, end);
    expect(body).toContain("openBillingPortal");
    expect(body).toContain("window.location.assign");
    expect(body).not.toContain("changeMembershipPlan");
    expect(body).not.toContain("saveUserPlan");
    expect(body).toContain("PLUS_BLOCKED_BY_PRO_MESSAGE");
    expect(body).not.toContain("reconcileActiveSessionPeriodForPlanChange");
    expect(body).not.toMatch(/profiles.*update|\.from\(["']profiles["']\)/);
  });

  it("payment checkout only stores pending_checkout_plan_id, not active plan", () => {
    const source = read("src/components/PlanSelectionPage.jsx");
    const start = source.indexOf("async function handleChoosePayment");
    const end = source.indexOf("async function handleChooseBilling", start);
    const body = source.slice(start, end);
    expect(body).toContain("markPendingCheckoutPlan");
    expect(body).toContain("startOnboardingBillingCheckout");
    expect(body).toContain("window.location.assign");
    expect(body).not.toContain("saveUserPlan");
    expect(body).not.toContain("changeMembershipPlan");
  });

  it("change-plan API keeps current plan until webhook for upgrades", () => {
    const node = read("server/lib/billingMembership.js");
    const cf = read("functions/_lib/billingMembershipApi.js");
    expect(node).toContain("Keep Plus until Stripe confirms the paid upgrade");
    expect(cf).toContain("Never grant Pro entitlement here");
    expect(node).toMatch(/plan_id:\s*currentPlan/);
    expect(cf).toMatch(/plan_id:\s*currentPlan/);
    expect(node).toContain("downgrade_not_allowed");
    expect(node).not.toMatch(/reconcileActiveSessionPeriodForPlanChange\(subscriber\.id,\s*targetPlan/);
  });

  it("subscription.updated does not unlock Pro without paymentConfirmed", () => {
    const cf = read("functions/_lib/stripeBilling.js");
    expect(cf).toContain("paymentConfirmed = false");
    expect(cf).toContain("pendingUpgrade");
    expect(cf).toContain("must not unlock Pro until a paid invoice confirms");
    expect(cf).toContain("syncSubscription(context, subscription, { paymentConfirmed: true })");
  });

  it("shared subscription provider remains the source of truth after Stripe return", () => {
    const panel = read("src/dashboard/components/settings/BillingMembershipPanel.jsx");
    const wallet = read("src/components/PlanSelectionPage.jsx");
    expect(panel).toContain("syncAfterStripe");
    expect(panel).toContain("Syncing your plan");
    expect(wallet).toContain("syncAfterStripe");
  });
});
