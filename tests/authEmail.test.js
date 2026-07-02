import { describe, expect, it } from "vitest";
import { buildAuthEmailHtml } from "../server/lib/authEmail.js";
import { PASSWORD_RESET_LINK_EXPIRY_MINUTES } from "../shared/passwordResetConstants.js";

describe("auth email templates", () => {
  it("includes expiry guidance on password reset emails", () => {
    const html = buildAuthEmailHtml({
      kind: "password-reset",
      url: "https://prelude.example/reset-password?token_hash=abc&type=recovery"
    });
    expect(html).toContain("Reset your password");
    expect(html).toContain(`expires in about ${PASSWORD_RESET_LINK_EXPIRY_MINUTES} minutes`);
    expect(html).toContain("only be used once");
    expect(html).toContain("https://prelude.example/reset-password?token_hash=abc&amp;type=recovery");
  });

  it("does not add expiry copy to verification emails", () => {
    const html = buildAuthEmailHtml({
      kind: "verify-email",
      url: "https://prelude.example/verify-email?token_hash=abc&type=signup"
    });
    expect(html).toContain("Verify your email");
    expect(html).not.toContain("expires in about");
  });
});
