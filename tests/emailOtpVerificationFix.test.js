import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  resend: vi.fn(),
  fetch: vi.fn()
}));

vi.mock("../src/lib/supabaseConfig.js", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseConfigError: () => "",
  getSupabaseProjectRef: () => "test-project",
  getPublicAppUrl: () => "https://prelude.example"
}));

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    auth: {
      getSession: mocks.getSession,
      verifyOtp: mocks.verifyOtp,
      getUser: mocks.getUser,
      resend: mocks.resend
    }
  })
}));

import { establishSignupOtpSession, resendSignupConfirmationWithClient } from "../src/lib/supabaseAuth.js";
import { verifyLoginCode } from "../src/lib/loginVerification.js";
import { friendlyVerificationError } from "../src/components/AuthPages.jsx";

describe("signup email OTP verification", () => {
  beforeEach(() => {
    mocks.verifyOtp.mockReset();
    mocks.getUser.mockReset();
    mocks.resend.mockReset();
  });

  it("passes the raw six-digit code as token with type email", async () => {
    const user = {
      id: "u1",
      email: "student@example.edu",
      email_confirmed_at: "2026-08-02T00:00:00.000Z"
    };
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { user }, user },
      error: null
    });

    const result = await establishSignupOtpSession(
      { auth: { verifyOtp: mocks.verifyOtp, getUser: mocks.getUser } },
      " Student@Example.edu ",
      "012345"
    );

    expect(result.error).toBeNull();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "student@example.edu",
      token: "012345",
      type: "email"
    });
    const call = mocks.verifyOtp.mock.calls[0][0];
    expect(call).not.toHaveProperty("token_hash");
    expect(call.token).toHaveLength(6);
    expect(call.token.startsWith("0")).toBe(true);
  });

  it("blocks verification when the pending email is missing", async () => {
    const result = await establishSignupOtpSession(
      { auth: { verifyOtp: mocks.verifyOtp, getUser: mocks.getUser } },
      "   ",
      "123456"
    );
    expect(result.error).toMatch(/could not determine which email/i);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("maps invalid and expired OTP errors", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: "Token has expired or is invalid", status: 403 }
    });
    const expired = await establishSignupOtpSession(
      { auth: { verifyOtp: mocks.verifyOtp, getUser: mocks.getUser } },
      "student@example.edu",
      "111111"
    );
    expect(expired.error).toMatch(/invalid or has expired/i);

    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: "For security purposes, you can only request this after 60 seconds.", status: 429 }
    });
    const limited = await establishSignupOtpSession(
      { auth: { verifyOtp: mocks.verifyOtp, getUser: mocks.getUser } },
      "student@example.edu",
      "111111"
    );
    expect(limited.error).toMatch(/too many attempts/i);
  });

  it("resends signup confirmation only through auth.resend signup", async () => {
    mocks.resend.mockResolvedValue({ error: null });
    const result = await resendSignupConfirmationWithClient(
      { auth: { resend: mocks.resend } },
      " Student@Example.edu "
    );
    expect(result.error).toBeNull();
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "student@example.edu"
    });
  });
});

describe("login verification API client", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.fetch.mockReset();
    globalThis.fetch = mocks.fetch;
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null
    });
  });

  it("posts the six-digit code to verify-login-challenge", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ verified: true })
    });

    const result = await verifyLoginCode({
      challengeId: "ch_1",
      code: "012345",
      trustDevice: true
    });

    expect(result.verified).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/auth/verify-login-challenge",
      expect.objectContaining({
        method: "POST",
        credentials: "include"
      })
    );
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      challengeId: "ch_1",
      code: "012345",
      trustDevice: true,
      deviceName: ""
    });
  });

  it("detects HTML fallback responses from a missing API handler", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => "<!doctype html><html><head></head><body>Prelude</body></html>"
    });

    await expect(verifyLoginCode({ code: "123456" })).rejects.toMatchObject({
      payload: { error: "html_response" }
    });
  });
});

describe("login verification error messages", () => {
  it("maps invalid/expired codes and rate limits clearly", () => {
    expect(friendlyVerificationError({ payload: { error: "incorrect_code" } })).toMatch(
      /invalid or has expired/i
    );
    expect(friendlyVerificationError({ payload: { error: "expired_code" } })).toMatch(
      /invalid or has expired/i
    );
    expect(friendlyVerificationError({ payload: { error: "rate_limited" } })).toMatch(
      /too many attempts/i
    );
    expect(friendlyVerificationError({ payload: { error: "html_response" } })).toMatch(
      /couldn’t verify your email right now/i
    );
    expect(friendlyVerificationError({ payload: { error: "missing_email" } })).toMatch(
      /could not determine which email/i
    );
  });

  it("does not expose unexpected JavaScript exception details", () => {
    expect(friendlyVerificationError(new TypeError("Cannot read properties of null (reading 'next')"))).toMatch(
      /couldn’t verify your email right now/i
    );
  });
});
