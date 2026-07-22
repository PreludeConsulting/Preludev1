// @vitest-environment happy-dom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import PreludeLogo from "../src/components/PreludeLogo.jsx";
import UniversityLogo from "../src/components/UniversityLogo.jsx";
import { UNIVERSITIES } from "../src/data/universities.js";

const EXPECTED_LOGO_SIZES = {
  stanford: [162, 248.022],
  harvard: [510, 600],
  mit: [321, 166],
  upenn: [92.015, 112.15125],
  princeton: [280, 357],
  yale: [512, 507],
  columbia: [437, 512],
  duke: [150, 133.68],
  northwestern: [152, 234.01],
  "johns-hopkins": [64.6, 64.6],
  brown: [185, 228],
  cornell: [99, 99],
  dartmouth: [512, 499],
  ucla: [512, 398],
  "uc-berkeley": [125.75, 100.56],
  uchicago: [403, 512],
  vanderbilt: [512, 356],
  rice: [134.75, 161.62],
  "notre-dame": [200, 180.15],
  georgetown: [252, 252.82],
  cmu: [512, 512],
  nyu: [36, 36],
  usc: [122.28, 182],
  michigan: [294.33, 212.39],
  unc: [170, 134]
};

function source(path) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("frontend media and animation performance contracts", () => {
  it("uses the Prelude artwork's real intrinsic dimensions", () => {
    const markup = renderToStaticMarkup(<PreludeLogo />);
    expect(markup).toContain('width="1024"');
    expect(markup).toContain('height="395"');
  });

  it("provides every university logo's real intrinsic dimensions to the image", () => {
    expect(UNIVERSITIES).toHaveLength(Object.keys(EXPECTED_LOGO_SIZES).length);

    for (const school of UNIVERSITIES) {
      expect([school.logoWidth, school.logoHeight], school.id).toEqual(EXPECTED_LOGO_SIZES[school.id]);
      const markup = renderToStaticMarkup(<UniversityLogo school={school} />);
      expect(markup, school.id).toContain(`width="${school.logoWidth}"`);
      expect(markup, school.id).toContain(`height="${school.logoHeight}"`);
    }
  });

  it("reserves the admissions illustration's 4:3 intrinsic geometry", () => {
    const banner = source("src/components/AdmissionsCostBanner.jsx");
    expect(banner).toContain("width={1024}");
    expect(banner).toContain("height={768}");
  });

  it("does not keep navbar blur or permanent compositor hints active", () => {
    const indexCss = source("src/index.css");
    const navBackdropRule = indexCss.match(/\.nav-bar__backdrop\s*\{[^}]+\}/)?.[0] || "";
    expect(navBackdropRule).not.toMatch(/backdrop-filter|translateZ/);
    expect(source("src/styles/mentors-page.css")).not.toMatch(/will-change\s*:/);
    expect(source("src/styles/plan-wallet.css")).not.toMatch(/will-change\s*:/);
  });

  it("allows the student-network headline to wrap at narrow and zoomed viewports", () => {
    const indexCss = source("src/index.css");
    const headlineRule = indexCss.match(/\.student-network-section__headline\s*\{[^}]+\}/)?.[0] || "";
    expect(headlineRule).toContain("white-space: normal");
    expect(headlineRule).toContain("text-wrap: balance");
    expect(headlineRule).not.toContain("white-space: nowrap");
  });

  it("viewport-gates continuous mentor review and rewards hero animations", () => {
    const mentors = source("src/components/MentorsPage.jsx");
    const rewards = source("src/dashboard/components/product/StudentProgressRewardsProduct.jsx");

    for (const component of [mentors, rewards]) {
      expect(component).toContain("useViewportActivity");
      expect(component).toContain("data-motion-active");
    }
  });
});
