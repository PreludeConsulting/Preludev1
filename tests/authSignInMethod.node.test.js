import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountDeletionUsesOAuth,
  accountDeletionUsesPassword,
  normalizeAuthProviders,
  resolveAuthSignInMethods
} from "../src/lib/authSignInMethod.js";

describe("authSignInMethod", () => {
  it("detects email/password accounts", () => {
    const methods = normalizeAuthProviders([{ provider: "email" }], {
      app_metadata: { provider: "email", providers: ["email"] }
    });
    assert.deepEqual(methods, ["email"]);
    assert.equal(accountDeletionUsesPassword(methods), true);
    assert.equal(accountDeletionUsesOAuth(methods), false);
  });

  it("detects Google-only OAuth accounts", () => {
    const methods = normalizeAuthProviders([], {
      app_metadata: { provider: "google", providers: ["google"] }
    });
    assert.equal(methods.includes("google"), true);
    assert.equal(accountDeletionUsesPassword(methods), false);
    assert.equal(accountDeletionUsesOAuth(methods), true);
  });

  it("prefers password flow when email and Google are both linked", () => {
    const methods = normalizeAuthProviders(
      [{ provider: "email" }, { provider: "google" }],
      { app_metadata: { provider: "email", providers: ["email", "google"] } }
    );
    assert.equal(accountDeletionUsesPassword(methods), true);
    assert.equal(accountDeletionUsesOAuth(methods), false);
  });

  it("reads cached authSignInMethods from app user", () => {
    const methods = resolveAuthSignInMethods({
      authProvider: "supabase",
      authSignInMethods: ["google"]
    });
    assert.deepEqual(methods, ["google"]);
  });

  it("ignores demo accounts for deletion verification", () => {
    const methods = resolveAuthSignInMethods({ authProvider: "demo" });
    assert.equal(accountDeletionUsesPassword(methods), false);
    assert.equal(accountDeletionUsesOAuth(methods), false);
  });
});
