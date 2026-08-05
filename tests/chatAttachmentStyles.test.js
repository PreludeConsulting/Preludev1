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

  it("keeps file attachment labels dark and readable", () => {
    expect(dashboardCss).toMatch(/\.msg-attachment__name\s*\{[\s\S]*?color:\s*#1c1c1e/i);
    expect(dashboardCss).toMatch(/\.msg-attachment__meta\s*\{[\s\S]*?color:\s*#4b5563/i);
  });
});
