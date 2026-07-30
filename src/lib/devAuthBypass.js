import { DEMO_STUDENT, getDemoAccountByKey } from "../data/demoAccounts.js";
import { getCurrentProductName } from "./currentProduct.js";
import { getPlan } from "./plans.js";

/** Dev-only: skip login and use a demo student session (never enabled in production builds). */
export function isDevAuthBypassEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "1";
}

export function shouldUseDemoFixtures(user) {
  if (!user) return false;
  if (user.authProvider === "demo" || user.authProvider === "dev") return true;
  return Boolean(user.email && /prelude-demo\.com$/i.test(user.email));
}

export function getDevBypassUser() {
  return buildDemoSessionUser(DEMO_STUDENT);
}

export function buildDemoSessionUser(account) {
  const planId = account.plan || "basic";
  const plan = getPlan(planId);
  const planName = getCurrentProductName(planId, account.displayPlanLabel || plan.name);

  return {
    id: `demo-${account.key}`,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    name: `${account.firstName} ${account.lastName}`,
    role: account.role.toLowerCase(),
    plan: planId,
    planName,
    planSelected: true,
    authProvider: "demo",
    emailVerified: true,
    onboardingStatus: "onboarding_completed",
    matchOnboardingComplete: true,
    paymentStepComplete: true,
    parentInviteStepComplete: true
  };
}

export function getDemoSessionUser(accountKey = "student") {
  const account = getDemoAccountByKey(accountKey) || DEMO_STUDENT;
  return buildDemoSessionUser(account);
}
