import { describe, expect, it } from "vitest";
import { buildMentorStudentPlanCredits, mentorFacingPlanLabel } from "../shared/mentorStudentRoster.js";

describe("mentor student roster plan credits", () => {
  it("labels Essay Support and review credits for one-time students", () => {
    const summary = buildMentorStudentPlanCredits({
      planId: "basic",
      subscriptionStatus: null,
      reviewCredits: { purchased: 5, assigned: 2, remaining: 3 }
    });
    expect(mentorFacingPlanLabel("basic")).toBe("Essay Support");
    expect(summary.planLabel).toBe("Essay Support");
    expect(summary.paymentType).toBe("one_time");
    expect(summary.creditType).toBe("review");
    expect(summary.usageSummary).toBe("3 of 5 review credits remaining");
    expect(summary.sessionAllowance).toBeNull();
    expect(summary.reviewCredits.remaining).toBe(3);
    expect(summary.essaySupportOnly).toBe(true);
  });

  it("shows Plus/Pro session credits without inventing review credits", () => {
    const plus = buildMentorStudentPlanCredits({
      planId: "plus",
      subscriptionStatus: "active",
      reviewCredits: { purchased: 0, assigned: 0, remaining: 0 },
      sessionCredits: { active: true, allowance: 2, remaining: 1 }
    });
    expect(plus.planLabel).toBe("Plus");
    expect(plus.paymentType).toBe("recurring");
    expect(plus.creditType).toBe("session");
    expect(plus.usageSummary).toBe("1 of 2 session credits remaining");
    expect(plus.reviewCredits).toBeNull();
    expect(plus.essaySupportOnly).toBe(false);

    const pro = buildMentorStudentPlanCredits({
      planId: "pro",
      subscriptionStatus: "active",
      sessionCredits: { active: true, allowance: 4, remaining: 4 }
    });
    expect(pro.planLabel).toBe("Pro");
    expect(pro.usageSummary).toBe("4 of 4 session credits remaining");
    expect(pro.usageSummary).not.toMatch(/review/i);
  });

  it("keeps Plus/Pro and Essay Support concurrent on the same account", () => {
    const combined = buildMentorStudentPlanCredits({
      planId: "pro",
      subscriptionStatus: "active",
      reviewCredits: { purchased: 3, assigned: 0, remaining: 3 },
      sessionCredits: { active: true, allowance: 4, remaining: 4 }
    });
    expect(combined.essaySupportOnly).toBe(false);
    expect(combined.hasActiveSubscription).toBe(true);
    expect(combined.hasEssaySupportCredits).toBe(true);
    expect(combined.planLabel).toContain("Pro");
    expect(combined.planLabel).toContain("Essay Support");
    expect(combined.paymentType).toBe("mixed");
    expect(combined.sessionAllowance).toEqual({ remaining: 4, included: 4 });
    expect(combined.reviewCredits.remaining).toBe(3);
    expect(combined.usageSummary).toMatch(/session credit/);
    expect(combined.usageSummary).toMatch(/review credit/);
  });

  it("preserves essay credits when subscription becomes inactive", () => {
    const afterCancel = buildMentorStudentPlanCredits({
      planId: "plus",
      subscriptionStatus: "canceled",
      reviewCredits: { purchased: 2, assigned: 0, remaining: 2 },
      sessionCredits: { active: false, allowance: 0, remaining: 0 }
    });
    expect(afterCancel.hasActiveSubscription).toBe(false);
    expect(afterCancel.essaySupportOnly).toBe(true);
    expect(afterCancel.reviewCredits.remaining).toBe(2);
  });

  it("handles cancel-at-period-end and no-plan states", () => {
    const canceling = buildMentorStudentPlanCredits({
      planId: "plus",
      subscriptionStatus: "active",
      subscriptionCancelAtPeriodEnd: true,
      sessionCredits: { active: true, allowance: 2, remaining: 2 }
    });
    expect(canceling.usageSummary).toMatch(/Cancels at period end/);

    const none = buildMentorStudentPlanCredits({
      planId: "plus",
      subscriptionStatus: "canceled",
      reviewCredits: { purchased: 0, assigned: 0, remaining: 0 },
      sessionCredits: { active: false, allowance: 0, remaining: 0 }
    });
    expect(none.planLabel).toBe("No active plan");
    expect(none.usageSummary).toBe("No active plan");
  });
});
