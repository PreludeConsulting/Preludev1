import { describe, expect, it } from "vitest";
import {
  MENTOR_ONBOARDING_PATH,
  ONBOARDING_STATUS,
  PLAN_SELECTION_PATH,
  ROLE_SELECTION_PATH,
  canAccessDashboard,
  postAuthDestination,
  userNeedsMatchDecision,
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
    roleSelectionComplete: true,
    matchOnboardingComplete: false,
    mentorOnboardingComplete: true,
    parentInviteStepComplete: true,
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

  it("keeps student plan onboarding unchanged", () => {
    const user = supabaseUser({
      role: "student",
      planSelected: false
    });

    expect(userNeedsPlanSelection(user)).toBe(true);
    expect(postAuthDestination(user)).toBe(PLAN_SELECTION_PATH);
  });

  it("blocks dashboard access until match and parent steps are complete", () => {
    const user = supabaseUser({
      role: "student",
      planSelected: true,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_MATCH,
      matchOnboardingComplete: false,
      parentInviteStepComplete: false
    });

    expect(canAccessDashboard(user)).toBe(false);
    expect(postAuthDestination(user)).toBe("/onboarding/match");
  });

  it("requires mentor selection after PreludeMatch when quiz is complete", () => {
    const user = supabaseUser({
      role: "student",
      planSelected: true,
      matchOnboardingComplete: true,
      mentorSelectionComplete: false
    });

    expect(userNeedsMatchDecision(user)).toBe(true);
    expect(postAuthDestination(user)).toBe("/onboarding/match?step=result");
  });
});
