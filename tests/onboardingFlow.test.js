import { describe, expect, it } from "vitest";
import {
  canAccessOnboardingPath,
  getFirstIncompleteStepIndex,
  getPreviousOnboardingPath,
  readOnboardingDraft,
  writeOnboardingDraft
} from "../src/lib/onboardingFlow.js";
import {
  MATCH_ONBOARDING_PATH,
  ONBOARDING_STATUS,
  PARENT_ONBOARDING_PATH,
  PLAN_SELECTION_PATH,
  ROLE_SELECTION_PATH
} from "../src/lib/onboardingRoutes.js";

function student(overrides = {}) {
  return {
    id: "student-1",
    authProvider: "supabase",
    role: "student",
    roleSelectionComplete: true,
    planSelected: false,
    matchOnboardingComplete: false,
    parentInviteStepComplete: false,
    mentorOnboardingComplete: true,
    ...overrides
  };
}

describe("onboarding flow navigation", () => {
  it("blocks skipping ahead to plan selection before role is complete", () => {
    const user = student({ roleSelectionComplete: false, planSelected: false });
    expect(canAccessOnboardingPath(user, PLAN_SELECTION_PATH)).toBe(false);
    expect(canAccessOnboardingPath(user, ROLE_SELECTION_PATH)).toBe(true);
  });

  it("allows returning to a completed plan step while match is incomplete", () => {
    const user = student({ planSelected: true, onboardingStatus: ONBOARDING_STATUS.NEEDS_MATCH });
    expect(canAccessOnboardingPath(user, PLAN_SELECTION_PATH)).toBe(true);
    expect(canAccessOnboardingPath(user, MATCH_ONBOARDING_PATH)).toBe(true);
    expect(canAccessOnboardingPath(user, PARENT_ONBOARDING_PATH)).toBe(false);
  });

  it("allows the mentor match result step when a decision is required", () => {
    const user = student({
      planSelected: true,
      matchOnboardingComplete: true,
      onboardingStatus: ONBOARDING_STATUS.MATCH_COMPLETED,
      matchDecision: null
    });
    expect(getFirstIncompleteStepIndex(user)).toBeGreaterThanOrEqual(3);
    expect(
      canAccessOnboardingPath(user, MATCH_ONBOARDING_PATH, new URLSearchParams("step=result"))
    ).toBe(true);
  });

  it("resolves the previous onboarding path for the plan step", () => {
    const user = student({ planSelected: false });
    expect(getPreviousOnboardingPath(user, PLAN_SELECTION_PATH)).toBe(ROLE_SELECTION_PATH);
  });

  it("allows returning to role selection while first setup is still incomplete", () => {
    const user = student({ roleSelectionComplete: true, planSelected: false });
    expect(canAccessOnboardingPath(user, ROLE_SELECTION_PATH)).toBe(true);
  });
});

describe("onboarding draft persistence", () => {
  it("stores and restores plan draft state by user id", () => {
    const storage = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key)
      }
    };

    writeOnboardingDraft("user-abc", { selectedPlanId: "plus", walletOpen: true });
    expect(readOnboardingDraft("user-abc")).toMatchObject({
      selectedPlanId: "plus",
      walletOpen: true
    });
  });
});
