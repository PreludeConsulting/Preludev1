import React from "react";
import { MemoryRouter } from "react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/context/LanguageContext.jsx";
import PreludeMatch from "../src/components/hero/PreludeMatch.jsx";
import PreludeMatchIntro from "../src/components/hero/PreludeMatchIntro.jsx";
import PreludeMatchResults from "../src/components/hero/PreludeMatchResults.jsx";

function renderWithLanguage(element) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(LanguageProvider, null, element)
    )
  );
}

describe("PreludeMatch demo preview", () => {
  it("renders the layered cinematic PreludeMatch loop without a Try PreludeMatch hover CTA on the hero", () => {
    const html = renderWithLanguage(React.createElement(PreludeMatch, { cinematicOnly: true }));

    expect(html).toContain("pm-card__traffic-light");
    expect(html).toContain("pm-cinematic");
    expect(html).toContain('data-cinematic-duration-ms="24000"');
    expect(html).toContain("Four minutes of context.");
    expect(html).toContain("One mentor who actually fits.");
    expect(html).not.toContain("pm-cinematic__opener-accent");
    expect(html).toContain("Asim Yoonas");
    expect(html).toContain("Georgia Tech - STEM");
    expect(html).toContain("media/mentors/asim-yoonas.png");
    expect(html).toContain("Top mentor found");
    expect(html).toContain("Mentor profile complete");
    expect(html).toContain("Great job.");
    expect(html).toContain("Plan unlocked.");
    expect(html).toContain("Finalize reach school essay prompts");
    expect(html).toContain("Prepare questions for Asim");
    expect(html).toContain("Your plan this week");
    expect(html).toContain("Mentor Meeting Completed");
    expect(html).toContain("College List Strategy");
    expect(html).toContain("Attend mentor meeting");
    expect(html).toContain("pm-cinematic__plan-row--meeting");
    expect(html).toContain("pm-cinematic__bank-scene");
    expect(html).toContain("pm-cinematic__bank-coin");
    expect(html).toContain("pm-cinematic__cash-note");
    expect(html).toContain("pm-cinematic__grad-hat");
    expect(html).toContain("pm-cinematic__task-check");
    expect(html).not.toContain("glass-piggy-bank-empty.png");
    expect(html).toContain("pm-cinematic__assembly");
    expect(html).toContain("pm-cinematic__layout-root--match");
    expect(html).toContain("pm-cinematic__layout-root");
    expect(html).toContain("pm-cinematic__layout-item--plan");
    expect(html).toContain("pm-cinematic__plan");
    expect(html).toContain("pm-cinematic__plan-expand");
    expect(html).toContain("pm-cinematic__reward-pill");
    expect(html).not.toContain("pm-cinematic__scene--mentor");
    expect(html).not.toContain("pm-cinematic__scene--dashboard");
    expect(html).not.toContain("pm-cinematic__layout-item--mentor");
    expect(html).toContain("pm-cinematic__opener");
    expect(html).toContain("pm-cinematic__camera");
    expect(html).toContain("pm-cinematic__atmosphere");
    expect(html).toContain("pm-cinematic__progress-glow");
    expect(html).not.toContain("pm-cinematic__demo-overlay");
    expect(html).not.toContain("Try PreludeMatch");
    expect(html).not.toContain("#050505");
    expect(html).not.toContain("Too many choices.");
    expect(html).not.toContain("pm-reference-ad");
    expect(html).not.toContain("pm-demo-trigger");
    expect(html).not.toContain("pm-motion-ad");
  });

  it("renders reduced-motion static wordmark without a demo overlay by default", () => {
    const html = renderWithLanguage(
      React.createElement(PreludeMatchIntro, { reducedMotion: true })
    );

    expect(html).toContain("pm-intro--static");
    expect(html).toContain("prelude-logo--compact");
    expect(html).not.toContain("Try PreludeMatch");
    expect(html).not.toContain("pm-cinematic__demo-overlay");
    expect(html).not.toContain("pm-cinematic__beat--opener");
    expect(html).not.toContain("Maya Patel");
    expect(html).not.toContain("Maya Chen");
    expect(html).not.toContain("Ryan Cain");
  });

  it("keeps an optional Try PreludeMatch trigger when explicitly enabled", () => {
    const html = renderWithLanguage(
      React.createElement(PreludeMatchIntro, {
        reducedMotion: true,
        onStart: () => {},
        showDemoTrigger: true
      })
    );

    expect(html).toContain("Try PreludeMatch");
    expect(html).toContain("pm-cinematic__demo-overlay");
  });

  it("renders the post-match dashboard payoff preview", () => {
    const html = renderWithLanguage(
      React.createElement(PreludeMatchResults, { reducedMotion: true, onRestart: () => {} })
    );

    expect(html).toContain("Dashboard unlocked");
    expect(html).toContain("Attend mentor meeting");
    expect(html).toContain("+25 coins");
    expect(html).toContain("Personal Statement Review");
    expect(html).toContain("SAT/ACT Help Session");
  });
});
