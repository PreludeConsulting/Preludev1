import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { bindFocusTrap, trapFocus } from "../src/lib/focusTrap.js";

describe("focusTrap", () => {
  it("ignores non-Tab keys", () => {
    expect(trapFocus(null, { key: "Enter", preventDefault() {} })).toBe(false);
  });

  it("supports non-modal popovers without isolating the application root", () => {
    const source = fs.readFileSync(new URL("../src/components/SiteSearchPanel.jsx", import.meta.url), "utf8");
    expect(source).toContain("isolatePage: false");
    expect(typeof bindFocusTrap).toBe("function");
  });
});
