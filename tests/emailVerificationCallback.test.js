import { describe, expect, it, vi } from "vitest";
import {
  establishEmailVerificationSession,
  establishSignupOtpSession,
  resendSignupConfirmationWithClient
} from "../src/lib/supabaseAuth.js";

function confirmedUser(overrides = {}) {
  return {
    id: "user-1",
    email: "student@example.edu",
    email_confirmed_at: "2026-07-30T12:00:00.000Z",
    ...overrides
  };
}

function authClient({ user = confirmedUser(), exchangeError = null, otpError = null } = {}) {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { user } }, error: exchangeError }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { user }, error: otpError }),
      resend: vi.fn().mockResolvedValue({ error: otpError }),
      setSession: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null })
    }
  };
}

describe("Supabase email-verification callback", () => {
  it("accepts a confirmed authenticated user opening the verification page without callback parameters", async () => {
    const supabase = authClient();
    const result = await establishEmailVerificationSession(supabase, "", "");

    expect(result).toMatchObject({ error: null, alreadyVerified: true });
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("verifies a custom token-hash link and creates a session in another browser", async () => {
    const supabase = authClient();
    const result = await establishEmailVerificationSession(
      supabase,
      "?token_hash=hashed-value&type=signup",
      ""
    );

    expect(result.error).toBeNull();
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hashed-value",
      type: "signup"
    });
  });

  it("exchanges a PKCE code when Supabase returns one", async () => {
    const supabase = authClient();
    const result = await establishEmailVerificationSession(supabase, "?code=auth-code", "");

    expect(result.error).toBeNull();
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
  });

  it("allows a refreshed callback page to reuse its confirmed session", async () => {
    const supabase = authClient();
    await establishEmailVerificationSession(supabase, "?code=auth-code", "");
    const refreshed = await establishEmailVerificationSession(supabase, "", "");

    expect(refreshed).toMatchObject({ error: null, alreadyVerified: true });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("returns a useful error for an expired or invalid link", async () => {
    const supabase = authClient({ otpError: new Error("Token has expired or is invalid") });
    const result = await establishEmailVerificationSession(
      supabase,
      "?token_hash=expired&type=signup",
      ""
    );

    expect(result.error).toBe("This secure link is invalid or expired. Request a new link and try again.");
  });

  it("rejects stale frontend state when the authoritative auth user is not confirmed", async () => {
    const supabase = authClient({ user: confirmedUser({ email_confirmed_at: null, confirmed_at: null }) });
    const result = await establishEmailVerificationSession(supabase, "", "");

    expect(result.error).toContain("not confirmed");
  });
});

describe("Supabase manual signup OTP", () => {
  it("verifies the correct six-digit code and reloads the authoritative user", async () => {
    const supabase = authClient();
    const result = await establishSignupOtpSession(
      supabase,
      " Student@Example.edu ",
      " 123456 "
    );

    expect(result.error).toBeNull();
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: "student@example.edu",
      token: "123456",
      type: "email"
    });
    expect(supabase.auth.getUser).toHaveBeenCalledOnce();
  });

  it("rejects an incomplete or non-numeric code without calling Supabase", async () => {
    const supabase = authClient();
    const result = await establishSignupOtpSession(supabase, "student@example.edu", "12 3x");

    expect(result.error).toBe("Enter the complete six-digit code.");
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("shows a clear incorrect-code error", async () => {
    const supabase = authClient({ otpError: new Error("Token is invalid") });
    const result = await establishSignupOtpSession(supabase, "student@example.edu", "111111");

    expect(result.error).toBe("That verification code is incorrect. Check the email and try again.");
  });

  it("shows a clear expired-code error", async () => {
    const supabase = authClient({ otpError: new Error("OTP has expired") });
    const result = await establishSignupOtpSession(supabase, "student@example.edu", "111111");

    expect(result.error).toBe("That verification code expired. Request a new code and try again.");
  });

  it("resends a signup code through Supabase Auth", async () => {
    const supabase = authClient();
    const result = await resendSignupConfirmationWithClient(supabase, " Student@Example.edu ");

    expect(result.error).toBeNull();
    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "student@example.edu"
    });
  });
});
