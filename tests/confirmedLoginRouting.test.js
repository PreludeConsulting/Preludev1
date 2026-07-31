import { describe, expect, it } from "vitest";
import { shouldRouteToSignupVerification } from "../src/components/AuthPages.jsx";

describe("confirmed login routing", () => {
  it("never routes an authenticated confirmed user to signup verification", () => {
    const error = new Error("Confirm your email before completing login verification.");
    const user = {
      email: "vincent.zhu@preludeconsultingllc.com",
      emailVerified: true
    };

    expect(shouldRouteToSignupVerification(error, user)).toBe(false);
    error.authenticatedUser = user;
    expect(shouldRouteToSignupVerification(error)).toBe(false);
  });

  it("still routes a genuinely unconfirmed sign-in failure to signup verification", () => {
    expect(shouldRouteToSignupVerification(new Error("Email not confirmed"), null)).toBe(true);
  });
});
