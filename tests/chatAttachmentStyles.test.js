import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardCss = readFileSync(
  new URL("../src/dashboard/dashboard.css", import.meta.url),
  "utf8"
);
const floatingCss = readFileSync(
  new URL("../src/dashboard/prelude-chat.css", import.meta.url),
  "utf8"
);

describe("attachment interaction styles", () => {
  it("limits the image link hit area to the image itself", () => {
    expect(dashboardCss).toMatch(/\.msg-bubble__image-link\s*\{[\s\S]*?pointer-events:\s*none/i);
    expect(dashboardCss).toMatch(/\.msg-bubble__image-link \.msg-bubble__image\s*\{[\s\S]*?pointer-events:\s*auto/i);
    expect(floatingCss).toMatch(/\.dash-msg-fab-bubble__image-link\s*\{[\s\S]*?pointer-events:\s*none/i);
    expect(floatingCss).toMatch(/\.dash-msg-fab-bubble__image\s*\{[\s\S]*?pointer-events:\s*auto/i);
  });

  it("keeps the shrunken image link block-level so auto margins side-align it", () => {
    expect(dashboardCss).toMatch(
      /\.msg-bubble__image-link\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*fit-content/i
    );
  });

  it("aligns the sent image itself to the right of the thread", () => {
    const sentRule = dashboardCss.match(
      /\.msg-group--me \.msg-bubble__image-link,\s*\n\.msg-group--me \.msg-bubble__image,\s*\n\.msg-group--me \.msg-attachment\s*\{([\s\S]*?)\}/
    );
    expect(sentRule?.[1]).toMatch(/margin-left:\s*auto/i);

    const receivedRule = dashboardCss.match(
      /\.msg-group--them \.msg-bubble__image-link,\s*\n\.msg-group--them \.msg-bubble__image,\s*\n\.msg-group--them \.msg-attachment\s*\{([\s\S]*?)\}/
    );
    expect(receivedRule?.[1]).toMatch(/margin-right:\s*auto/i);
  });

  it("caps attachment images in px so their boxes shrink to the rendered photo", () => {
    // A percentage cap is unresolvable while sizing the shrink-to-fit ancestors,
    // which stretches the bubble and strands the photo on its left edge.
    expect(dashboardCss).not.toMatch(/\.msg-bubble__image[\s\S]{0,120}?max-width:\s*min\(/i);
    expect(dashboardCss).toMatch(/\.msg-bubble__image\s*\{[\s\S]*?max-width:\s*260px/i);
  });

  it("keeps file attachment labels dark and readable", () => {
    expect(dashboardCss).toMatch(/\.msg-attachment__name\s*\{[\s\S]*?color:\s*#1c1c1e/i);
    expect(dashboardCss).toMatch(/\.msg-attachment__meta\s*\{[\s\S]*?color:\s*#4b5563/i);
  });
});
