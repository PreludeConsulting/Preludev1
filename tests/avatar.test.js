import { describe, expect, it } from "vitest";
import { isOAuthAvatarUrl, resolveAvatarUrl } from "../src/lib/avatar.js";

describe("avatar resolution", () => {
  it("uses a custom profile avatar before OAuth metadata", () => {
    expect(
      resolveAvatarUrl({
        profile: { avatarUrl: "https://cdn.prelude.com/avatars/user/avatar.webp" },
        user: {
          avatarUrl: "https://lh3.googleusercontent.com/google-photo",
          oauthAvatarUrl: "https://lh3.googleusercontent.com/google-photo"
        }
      })
    ).toBe("https://cdn.prelude.com/avatars/user/avatar.webp");
  });

  it("uses Google OAuth only when no custom avatar exists", () => {
    expect(
      resolveAvatarUrl({
        profile: { avatarUrl: "" },
        user: { oauthAvatarUrl: "https://lh3.googleusercontent.com/google-photo" }
      })
    ).toBe("https://lh3.googleusercontent.com/google-photo");
  });

  it("treats legacy Google URLs in profiles.avatar_url as OAuth fallback, not custom uploads", () => {
    expect(isOAuthAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocL")).toBe(true);
    expect(
      resolveAvatarUrl({
        profile: { avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocL" },
        user: { oauthAvatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocL" }
      })
    ).toBe("https://lh3.googleusercontent.com/a/ACg8ocL");
  });
});
