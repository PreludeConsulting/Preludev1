import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AuthDemoSection from "../src/components/auth/AuthDemoSection.jsx";
import { getDemoLoginPlanLabel, JORDAN_PLAN_DEMO_ACCOUNTS } from "../src/data/demoAccounts.js";
import { DEMO_SLUGS, getDemoDashboardForUser } from "../src/data/demoDashboardData.js";
import { getDemoLinkedChildren } from "../src/lib/parentLinks.js";

describe("demo Essay Support / Plus / Pro mentor roster", () => {
  it("labels the Essay Support login button instead of Basic", () => {
    expect(getDemoLoginPlanLabel(JORDAN_PLAN_DEMO_ACCOUNTS[0])).toBe("Essay Support");
    const markup = renderToStaticMarkup(
      createElement(AuthDemoSection, {
        loading: false,
        activeAction: "",
        onDemo: () => {}
      })
    );
    expect(markup).toContain("Jordan · Essay Support");
    expect(markup).toContain("Jordan · Plus");
    expect(markup).toContain("Jordan · Pro");
    expect(markup).not.toContain("Jordan · Basic");
  });

  it("gives Mentor Maya exactly three Jordan plan students", () => {
    const mentor = getDemoDashboardForUser("mentor@prelude-demo.com", "MENTOR");
    expect(mentor.summaryCards.students).toBe(3);
    expect(mentor.students).toHaveLength(3);
    expect(mentor.students.map((student) => student.id)).toEqual([
      DEMO_SLUGS.jordanEssay,
      DEMO_SLUGS.jordanPlus,
      DEMO_SLUGS.jordanPro
    ]);
    expect(mentor.students.map((student) => student.planLabel)).toEqual([
      "Essay Support",
      "Plus",
      "Pro"
    ]);
    expect(mentor.students[0].usageSummary).toBe("4 review credits remaining");
    expect(mentor.students[1].usageSummary).toBe("1 of 2 sessions remaining");
    expect(mentor.students[2].usageSummary).toBe("3 of 4 sessions remaining");
    expect(mentor.students.some((student) => /Alex|Ethan|Lily|Sofia|Priya|Noah|Maya Chen/i.test(student.name))).toBe(false);
  });

  it("links the parent demo to the three Jordan plan students", () => {
    const children = getDemoLinkedChildren();
    expect(children).toHaveLength(3);
    expect(children.map((child) => child.name)).toEqual([
      "Jordan — Essay Support",
      "Jordan — Plus",
      "Jordan — Pro"
    ]);
  });
});
