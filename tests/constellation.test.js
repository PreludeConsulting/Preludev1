import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PreludeConstellation from "../src/dashboard/components/product/PreludeConstellation.jsx";

describe("PreludeConstellation", () => {
  it("renders a section-specific identity and accessible state label", () => {
    const html = renderToStaticMarkup(
      React.createElement(PreludeConstellation, {
        variant: "colleges",
        value: 3,
        total: 6,
        active: true,
        label: "3 colleges saved to your college atlas"
      })
    );

    expect(html).toContain("COLLEGE ATLAS");
    expect(html).toContain("Save your next horizon");
    expect(html).toContain("prelude-constellation--stamp");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="3 colleges saved to your college atlas"');
  });

  it("lights nodes only from supplied progress", () => {
    const html = renderToStaticMarkup(
      React.createElement(PreludeConstellation, {
        variant: "rewards",
        value: 2,
        total: 6,
        label: "2 of 6 reward milestones completed"
      })
    );

    expect(html.match(/prelude-constellation__node--lit/g)).toHaveLength(2);
    expect(html.match(/prelude-constellation__node--current/g)).toHaveLength(1);
  });

  it("caps completion at six available nodes", () => {
    const html = renderToStaticMarkup(
      React.createElement(PreludeConstellation, {
        variant: "calendar",
        value: 100,
        total: 8
      })
    );

    expect(html.match(/prelude-constellation__node--lit/g)).toHaveLength(6);
    expect(html).toContain('aria-hidden="true"');
  });
});
