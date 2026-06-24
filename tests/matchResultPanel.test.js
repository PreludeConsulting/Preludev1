import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import MatchResultPanel from "../src/components/onboarding/MatchResultPanel.jsx";
import PreludeMentorCard from "../src/components/hero/PreludeMentorCard.jsx";

const mentor = {
  id: "mentor-1",
  initials: "MP",
  name: "Maya Patel",
  school: "Georgia Tech",
  major: "Computer Science",
  matchPercent: 94,
  tags: ["CS strategy", "Essays"],
  reason: "A strong fit for structured admissions guidance.",
  availability: "Available this week"
};

describe("PreludeMatch result actions", () => {
  it("renders authenticated workflow actions without the registration CTA", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchResultPanel, {
        mentor,
        loading: false,
        onAccept: vi.fn(),
        onCompare: vi.fn(),
        onDecline: vi.fn()
      })
    );

    expect(html).toContain("Accept &amp; Continue");
    expect(html).toContain("Compare Mentors");
    expect(html).toContain("Decline Recommendation");
    expect(html).not.toContain("View and book");
    expect(html).not.toContain("View mentor");
  });

  it("keeps the mentor-card CTA available outside authenticated results", () => {
    const html = renderToStaticMarkup(React.createElement(PreludeMentorCard, { mentor }));

    expect(html).toContain("View mentor");
  });
});
