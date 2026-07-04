/**
 * Central onboarding step model — single source of truth for navigation,
 * progress display, and URL access guards.
 */

import { roleFromUser } from "./dashboardRoutes.js";
import {
  MATCH_ONBOARDING_PATH,
  MENTOR_ONBOARDING_PATH,
  PARENT_ONBOARDING_PATH,
  PAYMENT_ONBOARDING_PATH,
  ROLE_SELECTION_PATH,
  canAccessDashboard,
  postAuthDestination,
  userNeedsMatchDecision,
  userNeedsMatchOnboarding,
  userNeedsMentorOnboarding,
  userNeedsParentInviteStep,
  userNeedsPaymentStep,
  userNeedsRoleSelection,
  userCanChangeRoleDuringOnboarding
} from "./onboardingRoutes.js";

const DRAFT_STORAGE_PREFIX = "prelude_onboarding_draft_";

export const ONBOARDING_STEP_IDS = {
  ROLE: "role",
  MATCH: "match",
  MATCH_RESULT: "match_result",
  PARENT: "parent",
  PAYMENT: "payment",
  MENTOR: "mentor"
};

const ONBOARDING_STEP_INCOMPLETE_REASONS = {
  [ONBOARDING_STEP_IDS.ROLE]: "Choose your role to continue.",
  [ONBOARDING_STEP_IDS.MATCH]: "Complete Prelude Match to continue.",
  [ONBOARDING_STEP_IDS.MATCH_RESULT]: "Review your match to continue.",
  [ONBOARDING_STEP_IDS.PARENT]: "Send a parent invite or choose Skip for now to continue.",
  [ONBOARDING_STEP_IDS.PAYMENT]: "Choose a plan and complete checkout to finish setup.",
  [ONBOARDING_STEP_IDS.MENTOR]: "Complete your mentor profile to continue."
};

function studentSteps() {
  return [
    {
      id: ONBOARDING_STEP_IDS.ROLE,
      path: ROLE_SELECTION_PATH,
      title: "Choose your role",
      subtitle: "Student, mentor, or parent — we route you to the right Prelude experience.",
      isComplete: (user) => !userNeedsRoleSelection(user),
      matchesPath: (pathname, searchParams) => pathname === ROLE_SELECTION_PATH
    },
    {
      id: ONBOARDING_STEP_IDS.MATCH,
      path: MATCH_ONBOARDING_PATH,
      title: "Prelude Match",
      subtitle: "Answer a few questions so we can suggest the right mentor.",
      isComplete: (user) =>
        !userNeedsRoleSelection(user) && !userNeedsMatchOnboarding(user),
      matchesPath: (pathname, searchParams) =>
        pathname === MATCH_ONBOARDING_PATH && searchParams?.get("step") !== "result"
    },
    {
      id: ONBOARDING_STEP_IDS.MATCH_RESULT,
      path: `${MATCH_ONBOARDING_PATH}?step=result`,
      title: "Meet your match",
      subtitle: "Review your mentor suggestion and decide how to continue.",
      isComplete: (user) =>
        !userNeedsRoleSelection(user) &&
        !userNeedsMatchOnboarding(user) &&
        !userNeedsMatchDecision(user),
      matchesPath: (pathname, searchParams) =>
        pathname === MATCH_ONBOARDING_PATH && searchParams?.get("step") === "result",
      optional: true
    },
    {
      id: ONBOARDING_STEP_IDS.PARENT,
      path: PARENT_ONBOARDING_PATH,
      title: "Invite a parent",
      subtitle: "Optional — give a guardian read-only access to your progress.",
      isComplete: (user) => Boolean(user.parentInviteStepComplete),
      matchesPath: (pathname) => pathname === PARENT_ONBOARDING_PATH
    },
    {
      id: ONBOARDING_STEP_IDS.PAYMENT,
      path: PAYMENT_ONBOARDING_PATH,
      title: "Choose your plan",
      subtitle: "Select a Prelude mentorship tier and complete secure checkout to finish setup.",
      isComplete: (user) => Boolean(user.paymentStepComplete),
      matchesPath: (pathname) =>
        pathname === PAYMENT_ONBOARDING_PATH || pathname.startsWith(`${PAYMENT_ONBOARDING_PATH}/`)
    }
  ];
}

function mentorSteps() {
  return [
    {
      id: ONBOARDING_STEP_IDS.ROLE,
      path: ROLE_SELECTION_PATH,
      title: "Choose your role",
      subtitle: "Tell Prelude whether you are joining as a student, mentor, or parent.",
      isComplete: (user) => !userNeedsRoleSelection(user),
      matchesPath: (pathname) => pathname === ROLE_SELECTION_PATH
    },
    {
      id: ONBOARDING_STEP_IDS.MENTOR,
      path: MENTOR_ONBOARDING_PATH,
      title: "Mentor profile",
      subtitle: "Share your background so students can learn from your experience.",
      isComplete: (user) => !userNeedsMentorOnboarding(user),
      matchesPath: (pathname) => pathname === MENTOR_ONBOARDING_PATH
    }
  ];
}

function parentSteps() {
  return [
    {
      id: ONBOARDING_STEP_IDS.ROLE,
      path: ROLE_SELECTION_PATH,
      title: "Choose your role",
      subtitle: "Confirm you are joining Prelude as a parent or guardian.",
      isComplete: (user) => !userNeedsRoleSelection(user),
      matchesPath: (pathname) => pathname === ROLE_SELECTION_PATH
    }
  ];
}

export function getOnboardingSteps(user) {
  if (!user) return [];
  const role = roleFromUser(user);
  if (role === "mentor") return mentorSteps();
  if (role === "parent") return parentSteps();
  return studentSteps().filter((step) => {
    if (step.id === ONBOARDING_STEP_IDS.ROLE && !userNeedsRoleSelection(user) && user.roleSelectionComplete !== false) {
      return true;
    }
    return true;
  });
}

export function getVisibleOnboardingSteps(user) {
  const steps = getOnboardingSteps(user);
  return steps.filter((step) => {
    if (step.id === ONBOARDING_STEP_IDS.ROLE && user?.roleSelectionComplete !== false && !userNeedsRoleSelection(user)) {
      return false;
    }
    return true;
  });
}

export function findOnboardingStepIndex(user, pathname, searchParams) {
  const steps = getOnboardingSteps(user);
  const params = searchParams || new URLSearchParams();
  return steps.findIndex((step) => step.matchesPath(pathname, params));
}

function findVisibleOnboardingStepIndex(user, pathname, searchParams) {
  const steps = getVisibleOnboardingSteps(user);
  const params = searchParams || new URLSearchParams();
  return steps.findIndex((step) => step.matchesPath(pathname, params));
}

export function getOnboardingProgress(user, pathname, searchParams) {
  const steps = getVisibleOnboardingSteps(user);
  const currentIndex = Math.max(0, findVisibleOnboardingStepIndex(user, pathname, searchParams));
  const completedCount = steps.filter((step) => step.isComplete(user)).length;
  return {
    steps,
    currentIndex: Math.min(currentIndex, Math.max(steps.length - 1, 0)),
    completedCount,
    totalSteps: steps.length
  };
}

export function getFirstIncompleteStepIndex(user) {
  const steps = getOnboardingSteps(user);
  const index = steps.findIndex((step) => !step.isComplete(user));
  return index === -1 ? steps.length : index;
}

export function canAccessOnboardingPath(user, pathname, searchParams) {
  if (!user) return false;
  if (pathname === ROLE_SELECTION_PATH && userCanChangeRoleDuringOnboarding(user)) {
    return true;
  }
  if (canAccessDashboard(user)) {
    return false;
  }

  const steps = getOnboardingSteps(user);
  const params = searchParams || new URLSearchParams();
  const targetIndex = steps.findIndex((step) => step.matchesPath(pathname, params));
  if (targetIndex === -1) return false;

  const furthestIndex = getFirstIncompleteStepIndex(user);
  if (furthestIndex >= steps.length) return false;

  const step = steps[targetIndex];
  if (step.isComplete(user)) return true;
  return targetIndex <= furthestIndex;
}

export function isOnboardingComplete(user) {
  return Boolean(user && canAccessDashboard(user));
}

export function getPreviousOnboardingPath(user, pathname, searchParams) {
  const steps = getVisibleOnboardingSteps(user);
  const params = searchParams || new URLSearchParams();
  const index = findVisibleOnboardingStepIndex(user, pathname, params);
  if (index <= 0) return null;
  return steps[index - 1]?.path || null;
}

export function getNextOnboardingPath(user) {
  return postAuthDestination(user);
}

export function getOnboardingStepNavigation(user, pathname, searchParams) {
  const steps = getVisibleOnboardingSteps(user);
  const params = searchParams || new URLSearchParams();
  const index = findVisibleOnboardingStepIndex(user, pathname, params);
  if (index === -1) {
    return {
      showBack: false,
      backPath: null,
      showNext: false,
      nextPath: null,
      nextDisabled: false,
      nextReason: ""
    };
  }

  const currentStep = steps[index];
  const previousStep = steps[index - 1] || null;
  const nextStep = steps[index + 1] || null;
  const showNext = Boolean(nextStep);
  const nextDisabled = showNext ? !currentStep.isComplete(user) : false;

  return {
    showBack: Boolean(previousStep),
    backPath: previousStep?.path || null,
    showNext,
    nextPath: nextStep?.path || null,
    nextDisabled,
    nextReason: nextDisabled ? ONBOARDING_STEP_INCOMPLETE_REASONS[currentStep.id] || "Complete this step to continue." : ""
  };
}

export function readOnboardingDraft(userId) {
  if (typeof window === "undefined" || !userId) return {};
  try {
    const raw = window.localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeOnboardingDraft(userId, patch) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const current = readOnboardingDraft(userId);
    window.localStorage.setItem(
      `${DRAFT_STORAGE_PREFIX}${userId}`,
      JSON.stringify({ ...current, ...patch, updatedAt: Date.now() })
    );
  } catch {
    /* storage unavailable */
  }
}

export function clearOnboardingDraft(userId) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}
