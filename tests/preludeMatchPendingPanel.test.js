import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { MatchPendingPanel } from "../src/components/onboarding/PreludeMatchOnboardingPage.jsx";

describe("MatchPendingPanel", () => {
  it("shows pending review copy without mentor recommendation UI", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchPendingPanel, {
        loading: false,
        onContinue: vi.fn()
      })
    );

    expect(html).toContain("Your mentor match is being processed");
    expect(html).toContain("Thanks for completing the PreludeMatch questionnaire");
    expect(html).toContain("reach out as soon as your match is ready");
    expect(html).toContain("pm-match-pending__status");
    expect(html).toContain("Continue to parent invite");
    expect(html).toContain("prelude-pig-mascot.png");
    expect(html).not.toContain("Your mentor matches");
    expect(html).not.toContain("matchPercent");
    expect(html).not.toContain("pm-mentor-card");
  });

  it("renders an update answers action when provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchPendingPanel, {
        loading: false,
        onContinue: vi.fn(),
        onEdit: vi.fn(),
        showAction: false
      })
    );

    expect(html).toContain("Update answers");
  });
});
