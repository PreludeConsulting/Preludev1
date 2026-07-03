import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STATUS,
  PAYMENT_ONBOARDING_PATH,
  canAccessDashboard,
  postAuthDestination,
  userNeedsPaymentStep
} from "../src/lib/onboardingRoutes.js";

describe("onboarding payment gating", () => {
  it("requires payment after parent invite even when a plan id exists locally", () => {
    const user = {
      id: "student-1",
      authProvider: "supabase",
      role: "student",
      roleSelectionComplete: true,
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: false,
      plan: "plus",
      planSelected: false,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_PAYMENT
    };

    expect(userNeedsPaymentStep(user)).toBe(true);
    expect(postAuthDestination(user)).toBe(PAYMENT_ONBOARDING_PATH);
    expect(canAccessDashboard(user)).toBe(false);
  });

  it("treats payment completion as the final onboarding gate", () => {
    const user = {
      id: "student-1",
      authProvider: "supabase",
      role: "student",
      roleSelectionComplete: true,
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: true,
      plan: "pro",
      planSelected: true,
      onboardingStatus: ONBOARDING_STATUS.ONBOARDING_COMPLETED
    };

    expect(userNeedsPaymentStep(user)).toBe(false);
    expect(canAccessDashboard(user)).toBe(true);
    expect(postAuthDestination(user)).toBe("/dashboard/student/overview");
  });
});
