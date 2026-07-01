import { describe, expect, it } from "vitest";
import {
  bootstrapAuthRecoveryRedirect,
  buildPasswordResetEmailUrl,
  extractRecoveryToken,
  normalizeGenerateLinkProperties,
  resolveAuthLandingRedirect
} from "../shared/authRecoveryLink.js";

describe("auth recovery links", () => {
  it("builds direct reset-password URLs with token_hash", () => {
    const url = buildPasswordResetEmailUrl("https://preludeconsultingllc.com", {
      hashed_token: "abc123hash",
      action_link: "https://project.supabase.co/auth/v1/verify?token=legacy"
    });
    expect(url).toBe("https://preludeconsultingllc.com/reset-password?token_hash=abc123hash&type=recovery");
  });

  it("extracts token from action_link when hashed_token is missing", () => {
    const action =
      "https://project.supabase.co/auth/v1/verify?token=legacyhash&type=recovery&redirect_to=https%3A%2F%2Fpreludeconsultingllc.com";
    expect(extractRecoveryToken({ action_link: action })).toBe("legacyhash");
    expect(buildPasswordResetEmailUrl("https://preludeconsultingllc.com", { action_link: action })).toBe(
      "https://preludeconsultingllc.com/reset-password?token_hash=legacyhash&type=recovery"
    );
  });

  it("never returns raw Supabase action_link URLs in emails", () => {
    const action = "https://project.supabase.co/auth/v1/verify?token=legacy";
    expect(buildPasswordResetEmailUrl("https://preludeconsultingllc.com", { action_link: action })).toBe(
      "https://preludeconsultingllc.com/reset-password?token_hash=legacy&type=recovery"
    );
  });

  it("normalizes generateLink payloads from Supabase admin", () => {
    expect(
      normalizeGenerateLinkProperties({
        properties: { hashed_token: "nested" },
        user: { id: "user-1" }
      }).hashed_token
    ).toBe("nested");
  });

  it("routes homepage search token_hash recovery params to reset-password", () => {
    expect(
      resolveAuthLandingRedirect({
        pathname: "/",
        search: "?token_hash=abc123hash&type=recovery"
      })
    ).toBe("/reset-password?token_hash=abc123hash&type=recovery");
  });

  it("bootstraps recovery redirects before React loads", () => {
    expect(
      bootstrapAuthRecoveryRedirect("/", "?token_hash=abc123hash&type=recovery", "")
    ).toBe("/reset-password?token_hash=abc123hash&type=recovery");
    expect(bootstrapAuthRecoveryRedirect("/reset-password", "?token_hash=abc&type=recovery", "")).toBeNull();
  });

  it("routes homepage hash otp errors to reset-password", () => {
    expect(
      resolveAuthLandingRedirect({
        pathname: "/",
        hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
      })
    ).toBe("/reset-password?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  });

  it("routes homepage recovery codes to reset-password", () => {
    expect(
      resolveAuthLandingRedirect({
        pathname: "/",
        search: "?code=pkce-recovery-code"
      })
    ).toBe("/reset-password?code=pkce-recovery-code");
  });

  it("ignores unrelated paths", () => {
    expect(resolveAuthLandingRedirect({ pathname: "/dashboard", hash: "#error=access_denied" })).toBeNull();
  });
});
