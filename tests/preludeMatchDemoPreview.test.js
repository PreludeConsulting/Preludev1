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
  it("renders the intro CTA and hover demo trigger", () => {
    const html = renderWithLanguage(React.createElement(PreludeMatch));

    expect(html).toContain("Start matching");
    expect(html).toContain("pm-card__traffic-light");
    expect(html).toContain("Try PreludeMatch");
    expect(html).toContain("pm-demo-trigger");
    expect(html).toContain("Admissions consulting OS");
    expect(html).not.toContain("pm-ambient-preview");
  });
});
