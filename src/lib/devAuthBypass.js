import { DEMO_STUDENT } from "../data/demoAccounts.js";
import { getPlan } from "./plans.js";

/** Dev-only: skip login and use a demo student session (never enabled in production builds). */
export function isDevAuthBypassEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "1";
}

export function getDevBypassUser() {
  const plan = getPlan("plus");

  return {
    id: "dev-bypass-user",
    email: DEMO_STUDENT.email,
    firstName: DEMO_STUDENT.firstName,
    lastName: DEMO_STUDENT.lastName,
    name: `${DEMO_STUDENT.firstName} ${DEMO_STUDENT.lastName}`,
    role: "student",
    plan: "plus",
    planName: plan.name,
    planSelected: true,
    authProvider: "dev",
    emailVerified: true,
    onboardingStatus: "onboarding_completed",
    matchOnboardingComplete: true
  };
}
