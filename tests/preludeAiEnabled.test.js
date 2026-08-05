import { describe, expect, it } from "vitest";
import { isPreludeAiEnabled, PRELUDE_AI_DISABLED_MESSAGE } from "../shared/preludeAiEnabled.js";

describe("prelude AI kill switch", () => {
  it("is off by default", () => {
    expect(isPreludeAiEnabled({})).toBe(false);
    expect(isPreludeAiEnabled({ PRELUDE_AI_ENABLED: "" })).toBe(false);
  });

  it("turns on only for an explicit truthy flag", () => {
    expect(isPreludeAiEnabled({ PRELUDE_AI_ENABLED: "1" })).toBe(true);
    expect(isPreludeAiEnabled({ VITE_PRELUDE_AI_ENABLED: "true" })).toBe(true);
    expect(isPreludeAiEnabled({ PRELUDE_AI_ENABLED: "0" })).toBe(false);
  });

  it("exposes a user-facing disabled message", () => {
    expect(PRELUDE_AI_DISABLED_MESSAGE).toMatch(/temporarily unavailable/i);
  });
});
