import { describe, expect, it } from "vitest";
import {
  interpretPasswordSamenessCheck,
  SAME_PASSWORD_RESET_MESSAGE
} from "../shared/passwordSameness.js";

describe("password sameness during reset", () => {
  it("flags a successful sign-in probe as same password", () => {
    expect(interpretPasswordSamenessCheck({ hasSession: true })).toEqual({
      sameAsCurrent: true,
      uncertain: false
    });
  });

  it("treats invalid credentials as a different password", () => {
    expect(
      interpretPasswordSamenessCheck({
        hasSession: false,
        errorMessage: "Invalid login credentials"
      })
    ).toEqual({
      sameAsCurrent: false,
      uncertain: false
    });
  });

  it("allows uncertain auth states (e.g. OAuth-only accounts)", () => {
    expect(
      interpretPasswordSamenessCheck({
        hasSession: false,
        errorMessage: "Email not confirmed"
      })
    ).toEqual({
      sameAsCurrent: false,
      uncertain: true
    });
  });

  it("exposes a stable same-password message", () => {
    expect(SAME_PASSWORD_RESET_MESSAGE).toMatch(/cannot be the same/i);
  });
});
