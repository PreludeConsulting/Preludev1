import { PLAN_IDS } from "./plans.js";
import { sanitizeAuthRedirect } from "./authRedirects.js";
import { postAuthDestination } from "./onboardingRoutes.js";

export const PENDING_JOURNEY_KEY = "prelude-pending-auth-journey";
const JOURNEY_STEPS = new Set(["role", "plan", "match", "parent", "payment", "mentor", "result"]);

function safeSelection(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim();
  return /^[A-Za-z0-9:_-]{1,120}$/.test(normalized) ? normalized : null;
}

export function normalizePendingJourney(input = {}) {
  const journey = input ?? {};
  const next = sanitizeAuthRedirect(journey.next || "/dashboard", "/dashboard");
  const onboardingStep = JOURNEY_STEPS.has(journey.onboardingStep) ? journey.onboardingStep : null;
  return {
    next,
    mentorId: safeSelection(journey.mentorId),
    serviceId: safeSelection(journey.serviceId),
    planId: PLAN_IDS.includes(journey.planId) ? journey.planId : null,
    onboardingStep
  };
}

export function savePendingJourney(input = {}) {
  const normalized = normalizePendingJourney(input);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(PENDING_JOURNEY_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function readPendingJourney() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_JOURNEY_KEY);
    return raw ? normalizePendingJourney(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearPendingJourney() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(PENDING_JOURNEY_KEY);
}

export function resolveJourneyDestination(journey, user) {
  const normalized = normalizePendingJourney(journey);
  const destination = normalized.next || postAuthDestination(user);
  const url = new URL(destination, "https://prelude.local");
  if (normalized.mentorId) url.searchParams.set("mentor", normalized.mentorId);
  if (normalized.serviceId) url.searchParams.set("service", normalized.serviceId);
  if (normalized.planId) url.searchParams.set("plan", normalized.planId);
  return `${url.pathname}${url.search}${url.hash}`;
}
