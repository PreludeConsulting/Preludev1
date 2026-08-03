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
  });

  it("shows Plus/Pro session credits and never review-credit copy", () => {
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
