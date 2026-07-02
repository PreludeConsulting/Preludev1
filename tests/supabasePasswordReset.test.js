import { describe, expect, it } from "vitest";
import {
  createSupabaseAdmin,
  normalizeResetEmail,
  resolvePasswordResetEmail
} from "../server/lib/supabasePasswordReset.js";

describe("supabase password reset helpers", () => {
  it("normalizes email addresses", () => {
    expect(normalizeResetEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(normalizeResetEmail("")).toBe("");
  });

  it("requires no supabase admin config by default in tests", () => {
    expect(createSupabaseAdmin({})).toBeNull();
  });

  it("returns the requested email when no access token is provided", async () => {
    await expect(
      resolvePasswordResetEmail({
        requestedEmail: "Student@Example.com",
        accessToken: "",
        env: {}
      })
    ).resolves.toBe("student@example.com");
  });
});
