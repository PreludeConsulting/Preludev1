import { describe, expect, it } from "vitest";
import { sanitizeAuthRedirect } from "../src/lib/authRedirects.js";
import { friendlyAuthError, friendlyProviderError } from "../src/lib/supabaseAuth.js";

describe("auth experience helpers", () => {
  it("keeps post-auth redirects inside the app", () => {
    expect(sanitizeAuthRedirect("/dashboard/student")).toBe("/dashboard/student");
    expect(sanitizeAuthRedirect(encodeURIComponent("/onboarding/plan"))).toBe("/onboarding/plan");
    expect(sanitizeAuthRedirect("https://evil.example")).toBe("/dashboard");
    expect(sanitizeAuthRedirect("//evil.example")).toBe("/dashboard");
    expect(sanitizeAuthRedirect("/auth/callback?code=secret")).toBe("/dashboard");
  });

  it("maps Supabase link failures to action-oriented copy", () => {
    expect(friendlyAuthError({ message: "invalid_grant: code verifier should be non-empty" })).toBe(
      "This secure link is invalid or expired. Request a new link and try again."
    );
    expect(friendlyAuthError({ message: "Email rate limit exceeded" })).toBe(
      "We couldn't send that email right now. Please wait a moment and try again."
    );
    expect(friendlyAuthError({ message: "captcha protection: request disallowed (no captcha_token found)" })).toBe(
      "The security check could not be verified. Please complete it again."
    );
  });

  it("maps provider callback errors without exposing raw callback details", () => {
    expect(friendlyProviderError("access_denied")).toBe("Google sign-in was canceled.");
    expect(friendlyProviderError("expired_token")).toBe(
      "This secure link is invalid or expired. Request a new link and try again."
    );
    expect(friendlyProviderError("redirect_uri_mismatch")).toBe(
      "This auth redirect is not allowed yet. Check the Supabase redirect URL allow list."
    );
  });
});
