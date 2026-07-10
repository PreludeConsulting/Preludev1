import { describe, expect, it, beforeEach } from "vitest";
import {
  PENDING_JOURNEY_KEY,
  readPendingJourney,
  savePendingJourney,
  clearPendingJourney,
  normalizePendingJourney,
  resolveJourneyDestination
} from "../src/lib/authJourney.js";

describe("Phase 2 auth journey handoff", () => {
  beforeEach(() => {
    const values = new Map();
    globalThis.window = {
      sessionStorage: {
        clear: () => values.clear(),
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
      }
    };
  });

  it("preserves safe mentor, service, plan, and destination selections through auth", () => {
    savePendingJourney({
      next: "/onboarding/match?step=result",
      mentorId: "mentor-42",
      serviceId: "essay-review",
      planId: "plus",
      onboardingStep: "match"
    });

    expect(window.sessionStorage.getItem(PENDING_JOURNEY_KEY)).toBeTruthy();
    expect(readPendingJourney()).toEqual({
      next: "/onboarding/match?step=result",
      mentorId: "mentor-42",
      serviceId: "essay-review",
      planId: "plus",
      onboardingStep: "match"
    });
  });

  it("drops unsafe external paths and malformed selection values", () => {
    expect(normalizePendingJourney({
      next: "https://evil.example/steal",
      mentorId: "<script>",
      serviceId: "essay-review",
      planId: "not-a-plan"
    })).toEqual({
      next: "/dashboard",
      mentorId: null,
      serviceId: "essay-review",
      planId: null,
      onboardingStep: null
    });
  });

  it("resolves a pending journey before the generic post-auth destination", () => {
    expect(resolveJourneyDestination({
      next: "/onboarding/match?step=result",
      mentorId: "mentor-42",
      serviceId: "essay-review",
      planId: "plus",
      onboardingStep: "match"
    }, { role: "student" })).toBe("/onboarding/match?step=result&mentor=mentor-42&service=essay-review&plan=plus");
  });

  it("clears the handoff after completion", () => {
    savePendingJourney({ next: "/prelude-match", mentorId: "mentor-1" });
    clearPendingJourney();
    expect(readPendingJourney()).toBeNull();
  });
});
