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

  it("builds payment links toward Plus subscription checkout with mentor context", () => {
    const path = buildPurchaseSessionsPath({
      mentorId: "alex",
      mentorUserId: "22222222-2222-2222-2222-222222222222"
    });
    expect(path).toContain("plan=plus");
    expect(path).toContain("wallet=open");
    expect(path).not.toContain("bundle=flexible_sessions");
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

  it("does not count essay_support packages as live mentor sessions", () => {
    const result = evaluateMentorAccess({
      user: { plan: "basic", subscriptionStatus: "canceled" },
      packages: [
        { status: "active", sessionsRemaining: 5, bundleId: "essay_support", mentorUserId: null }
      ]
    });
    expect(result.allowed).toBe(false);
    expect(result.packageRemaining).toBe(0);
  });

  it("still counts flexible_sessions packages for mentor access", () => {
    const result = evaluateMentorAccess({
      user: { plan: "basic", subscriptionStatus: "canceled" },
      packages: [
        { status: "active", sessionsRemaining: 5, bundleId: "essay_support", mentorUserId: null },
        { status: "active", sessionsRemaining: 2, bundleId: "flexible_sessions", mentorUserId: null }
      ]
    });
    expect(result.allowed).toBe(true);
    expect(result.packageRemaining).toBe(2);
  });

  it("blocks a second Plus/Pro Book a Session submission on the same day", () => {
    const now = new Date("2026-07-30T18:00:00.000Z");
    const result = evaluateMentorAccess({
      user: { plan: "pro", subscriptionStatus: "active" },
      meetings: [
        {
          status: "pending",
          accessType: "subscription",
          createdAt: "2026-07-30T14:00:00.000Z",
          startTime: "2026-08-02T16:00:00.000Z"
        }
      ],
      packages: [],
      now,
      sessionCredits: { active: true, remaining: 3, allowance: 4, periodEnd: "2026-08-20T00:00:00.000Z" }
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("daily_booking_limit");
    expect(result.subscriptionRemaining).toBe(3);
  });

  it("allows another Plus/Pro booking the next day", () => {
    const now = new Date("2026-07-31T18:00:00.000Z");
    const result = evaluateMentorAccess({
      user: { plan: "plus", subscriptionStatus: "active" },
      meetings: [
        {
          status: "pending",
          accessType: "subscription",
          createdAt: "2026-07-30T14:00:00.000Z",
          startTime: "2026-08-02T16:00:00.000Z"
        }
      ],
      packages: [],
      now,
      sessionCredits: { active: true, remaining: 1, allowance: 2, periodEnd: "2026-08-20T00:00:00.000Z" }
    });
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe("subscription");
  });

  it("does not apply the daily limit to package-backed requests", () => {
    const now = new Date("2026-07-30T18:00:00.000Z");
    const result = evaluateMentorAccess({
      user: { plan: "basic", subscriptionStatus: "canceled" },
      meetings: [
        {
          status: "pending",
          accessType: "session_package",
          createdAt: "2026-07-30T14:00:00.000Z",
          startTime: "2026-08-02T16:00:00.000Z"
        }
      ],
      packages: [{ status: "active", sessionsRemaining: 2, mentorUserId: null }],
      now
    });
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe("session_package");
  });
});
