import { describe, expect, it } from "vitest";
import {
  MATCH_ONBOARDING_PATH,
  MENTOR_ONBOARDING_PATH,
  ONBOARDING_STATUS,
  PARENT_ONBOARDING_PATH,
  PAYMENT_ONBOARDING_PATH,
  ROLE_SELECTION_PATH,
  canAccessDashboard,
  postAuthDestination,
  userNeedsMatchDecision,
  userNeedsPaymentStep,
  userNeedsRoleSelection,
  userNeedsMentorOnboarding,
  userNeedsPlanSelection
} from "../src/lib/onboardingRoutes.js";

function supabaseUser(overrides = {}) {
  return {
    id: "user-1",
    authProvider: "supabase",
    role: "student",
    planSelected: false,
    paymentStepComplete: false,
    roleSelectionComplete: true,
    matchOnboardingComplete: false,
    mentorOnboardingComplete: true,
    parentInviteStepComplete: false,
    ...overrides
  };
}

describe("onboarding route decisions", () => {
  it("sends legacy Supabase users without a saved role to role selection", () => {
    const user = supabaseUser({
      role: "student",
      roleSelectionComplete: false,
      planSelected: false
    });

    expect(userNeedsRoleSelection(user)).toBe(true);
    expect(userNeedsPlanSelection(user)).toBe(false);
    expect(postAuthDestination(user)).toBe(ROLE_SELECTION_PATH);
    expect(canAccessDashboard(user)).toBe(false);
  });

  it("sends new Supabase mentors to mentor onboarding without requiring a student plan", () => {
    const user = supabaseUser({
      role: "mentor",
      planSelected: false,
      mentorOnboardingComplete: false
    });

    expect(userNeedsPlanSelection(user)).toBe(false);
    expect(userNeedsMentorOnboarding(user)).toBe(true);
    expect(postAuthDestination(user)).toBe(MENTOR_ONBOARDING_PATH);
    expect(canAccessDashboard(user)).toBe(false);
  });

  it("lets completed mentors continue to the mentor dashboard", () => {
    const user = supabaseUser({
      role: "mentor",
      planSelected: false,
      mentorOnboardingComplete: true
    });

    expect(userNeedsPlanSelection(user)).toBe(false);
    expect(userNeedsMentorOnboarding(user)).toBe(false);
    expect(postAuthDestination(user)).toBe("/dashboard/mentor/overview");
    expect(canAccessDashboard(user)).toBe(true);
  });

  it("sends matching team mentors through mentor onboarding before dashboard access", () => {
    const user = supabaseUser({
      role: "mentor",
      systemRole: "admin",
      matchingTeamAccess: true,
      mentorOnboardingComplete: false
    });

    expect(postAuthDestination(user)).toBe(MENTOR_ONBOARDING_PATH);
    expect(canAccessDashboard(user)).toBe(false);
  });

  it("lets completed matching team mentors continue to the mentor dashboard", () => {
    const user = supabaseUser({
      role: "mentor",
      systemRole: "admin",
      matchingTeamAccess: true,
      mentorOnboardingComplete: true
    });

    expect(postAuthDestination(user)).toBe("/dashboard/mentor/overview");
    expect(canAccessDashboard(user)).toBe(true);
  });

  it("sends new students to Prelude Match before plan selection", () => {
    const user = supabaseUser({
      role: "student",
      planSelected: false,
      matchOnboardingComplete: false
    });

    expect(userNeedsPlanSelection(user)).toBe(false);
    expect(postAuthDestination(user)).toBe(MATCH_ONBOARDING_PATH);
  });

  it("blocks dashboard access until match, parent, and payment steps are complete", () => {
    const user = supabaseUser({
      role: "student",
      onboardingStatus: ONBOARDING_STATUS.NEEDS_MATCH,
      matchOnboardingComplete: false,
      parentInviteStepComplete: false,
      paymentStepComplete: false
    });

    expect(canAccessDashboard(user)).toBe(false);
    expect(postAuthDestination(user)).toBe("/onboarding/match");
  });

  it("routes students to payment after parent invite is complete", () => {
    const user = supabaseUser({
      role: "student",
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: false,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_PAYMENT
    });

    expect(userNeedsPaymentStep(user)).toBe(true);
    expect(postAuthDestination(user)).toBe(PAYMENT_ONBOARDING_PATH);
    expect(canAccessDashboard(user)).toBe(false);
  });

  it("allows dashboard access only after payment is confirmed", () => {
    const user = supabaseUser({
      role: "student",
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: true,
      planSelected: true,
      onboardingStatus: ONBOARDING_STATUS.ONBOARDING_COMPLETED
    });

    expect(userNeedsPaymentStep(user)).toBe(false);
    expect(userNeedsMatchDecision(user)).toBe(false);
    expect(postAuthDestination(user)).toBe("/dashboard/student/overview");
    expect(canAccessDashboard(user)).toBe(true);
  });

  it("sends promo students to Prelude Match even when payment is already waived", () => {
    const user = supabaseUser({
      role: "student",
      matchOnboardingComplete: false,
      parentInviteStepComplete: false,
      paymentStepComplete: true,
      paymentWaived: true,
      planSelected: true,
      onboardingStatus: ONBOARDING_STATUS.ONBOARDING_COMPLETED
    });

    expect(postAuthDestination(user)).toBe(MATCH_ONBOARDING_PATH);
    expect(userNeedsPaymentStep(user)).toBe(false);
    expect(canAccessDashboard(user)).toBe(false);
  });
});
