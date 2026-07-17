import { describe, expect, it } from "vitest";
import {
  buildPurchaseSessionsPath,
  buildSubscriptionPath,
  evaluateMentorAccess,
  isNoMentorAccessError,
  NO_MENTOR_ACCESS_CODE
} from "../shared/mentorAccess.js";

describe("mentor access gating", () => {
  it("allows students with remaining package sessions", () => {
    const result = evaluateMentorAccess({
      user: { plan: "basic", subscriptionStatus: "canceled" },
      packages: [{ status: "active", sessionsRemaining: 2, mentorUserId: null }]
    });
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe("session_package");
    expect(result.remainingSessions).toBe(2);
  });

  it("allows students with an active monthly subscription and credits", () => {
    const result = evaluateMentorAccess({
      user: { plan: "plus", subscriptionStatus: "active" },
      meetings: [],
      packages: []
    });
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe("subscription");
  });

  it("blocks students with neither package sessions nor subscription", () => {
    const result = evaluateMentorAccess({
      user: { plan: "basic", subscriptionStatus: null },
      meetings: [],
      packages: []
    });
    expect(result.allowed).toBe(false);
    expect(result.accessType).toBeNull();
    expect(result.remainingSessions).toBe(0);
  });

  it("blocks zero remaining sessions (purchase modal case)", () => {
    const result = evaluateMentorAccess({
      user: { plan: "basic" },
      packages: [{ status: "active", sessionsRemaining: 0 }]
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("no_sessions");
  });

  it("blocks expired or cancelled subscriptions", () => {
    expect(
      evaluateMentorAccess({
        user: { plan: "pro", subscriptionStatus: "canceled" },
        packages: []
      }).allowed
    ).toBe(false);
    expect(
      evaluateMentorAccess({
        user: { plan: "plus", subscriptionStatus: "cancelled" },
        packages: []
      }).allowed
    ).toBe(false);
  });

  it("recognizes NO_MENTOR_ACCESS API errors for the purchase modal", () => {
    expect(
      isNoMentorAccessError({
        payload: { code: NO_MENTOR_ACCESS_CODE, message: "denied" }
      })
    ).toBe(true);
  });

  it("builds payment links with mentor and product context", () => {
    const path = buildPurchaseSessionsPath({
      mentorId: "alex",
      mentorUserId: "22222222-2222-2222-2222-222222222222"
    });
    expect(path).toContain("bundle=flexible_sessions");
    expect(path).toContain("mentor=alex");
    expect(path).toContain("mentorUserId=22222222");
    expect(buildSubscriptionPath()).toBe("/dashboard/student/billing");
  });

  it("ignores expired or refunded packages", () => {
    const result = evaluateMentorAccess({
      user: { plan: "basic" },
      packages: [
        { status: "refunded", sessionsRemaining: 4 },
        { status: "active", sessionsRemaining: 2, expiresAt: "2000-01-01T00:00:00.000Z" }
      ]
    });
    expect(result.allowed).toBe(false);
  });
});
