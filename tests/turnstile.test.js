import { describe, expect, it } from "vitest";
import { captchaOptions, requireTurnstileToken } from "../src/lib/turnstile.js";

describe("Turnstile auth helpers", () => {
  it("requires a token when CAPTCHA is enabled", () => {
    expect(() => requireTurnstileToken("", true)).toThrow("complete the security check");
    expect(() => requireTurnstileToken("verified-token", true)).not.toThrow();
  });

  it("does not block deployments where CAPTCHA is not configured", () => {
    expect(() => requireTurnstileToken("", false)).not.toThrow();
  });

  it("only sends a non-empty token to Supabase", () => {
    expect(captchaOptions("")).toEqual({});
    expect(captchaOptions("verified-token")).toEqual({ captchaToken: "verified-token" });
  });
});
