import { describe, expect, it } from "vitest";

describe("nested admin deployment route imports", () => {
  it.each([
    "../api/admin/mentor-review/index.js",
    "../api/admin/mentor-review/[studentId]/assign.js",
    "../api/admin/promo-codes/index.js",
    "../api/admin/referral/rotate-codes.js"
  ])("loads %s", async (modulePath) => {
    const route = await import(modulePath);
    expect(route.default).toBeTypeOf("function");
  });
});
