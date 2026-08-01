import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSignupVerification,
  pendingSignupResendSeconds,
  readPendingSignupVerification,
  storePendingSignupVerification
} from "../src/lib/signupVerificationState.js";

describe("pending signup verification state", () => {
  beforeEach(() => {
    const values = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
      }
    };
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  it("preserves only the normalized email and resend timestamp across refresh", () => {
    storePendingSignupVerification(" Student@Example.edu ", { cooldownSeconds: 30 });

    expect(readPendingSignupVerification()).toEqual({
      email: "student@example.edu",
      createdAt: 1_000_000,
      resendAllowedAt: 1_030_000
    });
    expect(JSON.stringify(readPendingSignupVerification())).not.toMatch(/password|token|otp/i);
    expect(pendingSignupResendSeconds()).toBe(30);
  });

  it("clears verification state after success", () => {
    storePendingSignupVerification("student@example.edu");
    clearPendingSignupVerification();
    expect(readPendingSignupVerification()).toBeNull();
  });
});
