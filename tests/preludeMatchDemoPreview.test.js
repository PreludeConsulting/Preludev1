import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../src/context/LanguageContext.jsx";
import PreludeMatch from "../src/components/hero/PreludeMatch.jsx";

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
  it("renders decorative browser chrome and an accessible demo trigger on the hero card", () => {
    const html = renderWithLanguage(React.createElement(PreludeMatch));

    expect(html).toContain("pm-card__browser-chrome");
    expect(html).toContain("pm-card__traffic-light pm-card__traffic-light--red");
    expect(html).toContain("pm-card__traffic-light pm-card__traffic-light--yellow");
    expect(html).toContain("pm-card__traffic-light pm-card__traffic-light--green");
    expect(html).toContain("pm-card__demo-overlay");
    expect(html).toContain("type=\"button\"");
    expect(html).toContain("pm-demo-trigger");
    expect(html).toContain("aria-label=\"Try PreludeMatch\"");
    expect(html).toContain("pm-demo-trigger__triangle");
    expect(html).toContain("Try PreludeMatch");
    expect(html).toContain("Start matching");
    expect(html).not.toContain("pm-ambient-preview");
  });
});
