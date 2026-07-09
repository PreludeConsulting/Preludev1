import { describe, expect, it } from "vitest";
import {
  canAccessOnboardingPath,
  getFirstIncompleteStepIndex,
  getOnboardingProgress,
  getOnboardingStepNavigation,
  getPreviousOnboardingPath,
  readOnboardingDraft,
  writeOnboardingDraft
} from "../src/lib/onboardingFlow.js";
import {
  MATCH_ONBOARDING_PATH,
  ONBOARDING_STATUS,
  PARENT_ONBOARDING_PATH,
  PAYMENT_ONBOARDING_PATH,
  ROLE_SELECTION_PATH
} from "../src/lib/onboardingRoutes.js";

function student(overrides = {}) {
  return {
    id: "student-1",
    authProvider: "supabase",
    role: "student",
    roleSelectionComplete: true,
    planSelected: false,
    paymentStepComplete: false,
    matchOnboardingComplete: false,
    parentInviteStepComplete: false,
    mentorOnboardingComplete: true,
    ...overrides
  };
}

describe("onboarding flow navigation", () => {
  it("blocks skipping ahead to match before role is complete", () => {
    const user = student({ roleSelectionComplete: false });
    expect(canAccessOnboardingPath(user, MATCH_ONBOARDING_PATH)).toBe(false);
    expect(canAccessOnboardingPath(user, ROLE_SELECTION_PATH)).toBe(true);
  });

  it("allows match while payment is still incomplete", () => {
    const user = student({ matchOnboardingComplete: false, onboardingStatus: ONBOARDING_STATUS.NEEDS_MATCH });
    expect(canAccessOnboardingPath(user, MATCH_ONBOARDING_PATH)).toBe(true);
    expect(canAccessOnboardingPath(user, PARENT_ONBOARDING_PATH)).toBe(false);
    expect(canAccessOnboardingPath(user, PAYMENT_ONBOARDING_PATH)).toBe(false);
  });

  it("allows payment only after parent invite step is complete", () => {
    const user = student({
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: false,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_PAYMENT
    });

    expect(canAccessOnboardingPath(user, PAYMENT_ONBOARDING_PATH)).toBe(true);
    expect(canAccessOnboardingPath(user, PARENT_ONBOARDING_PATH)).toBe(true);
    expect(getPreviousOnboardingPath(user, PAYMENT_ONBOARDING_PATH)).toBe(PARENT_ONBOARDING_PATH);
  });

  it("allows the mentor match result step when a decision is required", () => {
    const user = student({
      matchOnboardingComplete: true,
      onboardingStatus: ONBOARDING_STATUS.MATCH_COMPLETED,
      matchDecision: null
    });
    expect(getFirstIncompleteStepIndex(user)).toBeGreaterThanOrEqual(2);
    expect(
      canAccessOnboardingPath(user, MATCH_ONBOARDING_PATH, new URLSearchParams("step=result"))
    ).toBe(true);
  });

  it("resolves the previous onboarding path for the match step", () => {
    const user = student({ matchOnboardingComplete: false });
    expect(getPreviousOnboardingPath(user, MATCH_ONBOARDING_PATH)).toBeNull();
  });

  it("allows returning to role selection while first setup is still incomplete", () => {
    const user = student({ roleSelectionComplete: true, matchOnboardingComplete: false });
    expect(canAccessOnboardingPath(user, ROLE_SELECTION_PATH)).toBe(true);
  });

  it("indexes visible student steps without counting hidden role selection", () => {
    const user = student({ matchOnboardingComplete: false });
    const progress = getOnboardingProgress(user, MATCH_ONBOARDING_PATH);

    expect(progress.steps.map((step) => step.title)).toEqual([
      "Prelude Match",
      "Meet your match",
      "Invite a parent",
      "Choose your plan"
    ]);
    expect(progress.currentIndex).toBe(0);
  });

  it("keeps the match result as the second visible step after questionnaire completion", () => {
    const user = student({
      matchOnboardingComplete: true,
      parentInviteStepComplete: false
    });
    const progress = getOnboardingProgress(user, MATCH_ONBOARDING_PATH, new URLSearchParams("step=result"));

    expect(progress.steps.map((step) => step.title)).toEqual([
      "Prelude Match",
      "Meet your match",
      "Invite a parent",
      "Choose your plan"
    ]);
    expect(progress.currentIndex).toBe(1);
  });

  it("models Back and Next rules for the four student onboarding steps", () => {
    const needsMatch = student({ matchOnboardingComplete: false });
    expect(getOnboardingStepNavigation(needsMatch, MATCH_ONBOARDING_PATH)).toMatchObject({
      showBack: false,
      showNext: true,
      nextDisabled: true,
      nextReason: "Complete Prelude Match to continue."
    });

    const matchComplete = student({
      matchOnboardingComplete: true,
      parentInviteStepComplete: false
    });
    expect(getOnboardingStepNavigation(matchComplete, MATCH_ONBOARDING_PATH)).toMatchObject({
      showBack: false,
      showNext: true,
      nextDisabled: false,
      nextPath: `${MATCH_ONBOARDING_PATH}?step=result`
    });
    expect(
      getOnboardingStepNavigation(matchComplete, MATCH_ONBOARDING_PATH, new URLSearchParams("step=result"))
    ).toMatchObject({
      showBack: true,
      backPath: MATCH_ONBOARDING_PATH,
      showNext: true,
      nextDisabled: false,
      nextPath: PARENT_ONBOARDING_PATH
    });
    expect(getOnboardingStepNavigation(matchComplete, PARENT_ONBOARDING_PATH)).toMatchObject({
      showBack: true,
      backPath: `${MATCH_ONBOARDING_PATH}?step=result`,
      showNext: true,
      nextDisabled: true,
      nextReason: "Send a parent invite or choose Skip for now to continue."
    });

    const readyForPayment = student({
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_PAYMENT
    });
    expect(getOnboardingStepNavigation(readyForPayment, PAYMENT_ONBOARDING_PATH)).toMatchObject({
      showBack: true,
      backPath: PARENT_ONBOARDING_PATH,
      showNext: false
    });
  });

  it("allows returning to completed parent invite step for Back navigation", () => {
    const user = student({
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: false,
      onboardingStatus: ONBOARDING_STATUS.NEEDS_PAYMENT
    });

    expect(canAccessOnboardingPath(user, PARENT_ONBOARDING_PATH)).toBe(true);
    expect(getOnboardingStepNavigation(user, PAYMENT_ONBOARDING_PATH)).toMatchObject({
      showBack: true,
      backPath: PARENT_ONBOARDING_PATH
    });
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
