import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import MentorMatchSelectionPanel from "../src/components/onboarding/MentorMatchSelectionPanel.jsx";

const mentors = [
  {
    id: "mentor-1",
    initials: "MP",
    name: "Maya Patel",
    school: "Georgia Tech",
    major: "Computer Science",
    matchPercent: 94,
    tags: ["CS strategy", "Essays"],
    reason: "A strong fit for structured admissions guidance.",
    availability: "Available this week"
  },
  {
    id: "mentor-2",
    initials: "JL",
    name: "Jordan Lee",
    school: "Emory",
    major: "Business",
    matchPercent: 88,
    tags: ["Essays", "Interviews"],
    reason: "Great for business school planning.",
    availability: "Evenings"
  }
];

describe("MentorMatchSelectionPanel", () => {
  it("shows choose-your-mentor copy and disables Continue until selection for two matches", () => {
    const html = renderToStaticMarkup(
      React.createElement(MentorMatchSelectionPanel, {
        mentors,
        matchedMentorCount: 2,
        selectedMentorId: null,
        loading: false,
        onSelectMentor: vi.fn(),
        onContinue: vi.fn()
      })
    );

    expect(html).toContain("Choose your mentor");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Accept &amp; Continue");
  });

  it("shows admin review copy and active Continue for three or more matches", () => {
    const html = renderToStaticMarkup(
      React.createElement(MentorMatchSelectionPanel, {
        mentors,
        matchedMentorCount: 3,
        selectedMentorId: null,
        loading: false,
        onSelectMentor: vi.fn(),
        onContinue: vi.fn()
      })
    );

    expect(html).toContain("Your mentor matches");
    expect(html).toContain("Our team will review your results");
    expect(html).not.toContain("pm-mentor-select-card--selectable");
    expect(html).not.toContain('disabled=""');
  });

  it("shows zero-match review copy with active Continue", () => {
    const html = renderToStaticMarkup(
      React.createElement(MentorMatchSelectionPanel, {
        mentors: [],
        matchedMentorCount: 0,
        selectedMentorId: null,
        loading: false,
        onSelectMentor: vi.fn(),
        onContinue: vi.fn()
      })
    );

    expect(html).toContain("We&#x27;re reviewing your match");
    expect(html).not.toContain('disabled=""');
  });
});
