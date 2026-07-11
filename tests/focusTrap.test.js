import { describe, expect, it } from "vitest";
import { trapFocus } from "../src/lib/focusTrap.js";

describe("focusTrap", () => {
  it("ignores non-Tab keys", () => {
    expect(trapFocus(null, { key: "Enter", preventDefault() {} })).toBe(false);
  });
});
