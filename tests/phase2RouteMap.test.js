import { describe, expect, it } from "vitest";
import { canonicalPhase2Path } from "../src/lib/phase2Routes.js";

describe("phase 2 canonical routes", () => {
  it("maps public aliases to the public PreludeMatch entry", () => {
    expect(canonicalPhase2Path("/match", false)).toBe("/prelude-match");
    expect(canonicalPhase2Path("/onboarding", false)).toBe("/prelude-match");
  });

  it("maps authenticated aliases to the real onboarding flow", () => {
    expect(canonicalPhase2Path("/match", true)).toBe("/onboarding/match");
    expect(canonicalPhase2Path("/dashboard/student/onboarding", true)).toBe("/onboarding/match");
  });
});
