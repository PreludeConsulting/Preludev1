import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { MatchPendingPanel } from "../src/components/onboarding/PreludeMatchOnboardingPage.jsx";

describe("MatchPendingPanel", () => {
  it("shows pending review copy without mentor recommendation UI", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchPendingPanel, {
        loading: false,
        onReturnToDashboard: vi.fn()
      })
    );

    expect(html).toContain("Your mentor match is being processed");
    expect(html).toContain("Thanks for completing the PreludeMatch questionnaire");
    expect(html).toContain("Return to dashboard");
    expect(html).toContain("prelude-pig-mascot.png");
    expect(html).not.toContain("Your mentor matches");
    expect(html).not.toContain("matchPercent");
    expect(html).not.toContain("pm-mentor-card");
  });
});
