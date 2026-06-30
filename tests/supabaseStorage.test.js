import { beforeEach, describe, expect, it, vi } from "vitest";

let supabaseMock;

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => supabaseMock
}));

const { uploadAvatar, validateAvatarFile } = await import("../src/lib/supabaseStorage.js");

function imageFile(overrides = {}) {
  return {
    type: "image/png",
    size: 1024,
    ...overrides
  };
}

function storageClient({ uploadError = null, profileError = null } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError });
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://cdn.example.com/user/avatar.png" } }));
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: profileError })
  }));

  return {
    upload,
    getPublicUrl,
    update,
    client: {
      storage: {
        from: vi.fn(() => ({ upload, getPublicUrl }))
      },
      from: vi.fn(() => ({ update }))
    }
  };
}

describe("supabaseStorage avatar uploads", () => {
  beforeEach(() => {
    supabaseMock = null;
  });

  it("validates avatar file types before upload", () => {
    expect(validateAvatarFile(imageFile({ type: "image/svg+xml" }))).toBe("Use a JPG, PNG, WebP, or GIF image.");
  });

  it("uploads the file and saves the public avatar URL to the profile", async () => {
    const mock = storageClient();
    supabaseMock = mock.client;

    const result = await uploadAvatar("user-1", imageFile());

    expect(result.error).toBeNull();
    expect(result.url).toMatch(/^https:\/\/cdn\.example\.com\/user\/avatar\.png\?t=/);
    expect(mock.upload).toHaveBeenCalledWith(
      "user-1/avatar.png",
      expect.objectContaining({ type: "image/png" }),
      expect.objectContaining({ upsert: true, contentType: "image/png" })
    );
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: result.url }));
  });

  it("returns an actionable setup message when the avatar bucket is missing", async () => {
    const mock = storageClient({ uploadError: { message: "Bucket not found" } });
    supabaseMock = mock.client;

    const result = await uploadAvatar("user-1", imageFile());

    expect(result.error).toBe("Avatar storage is not configured yet. Run supabase/setup-storage.sql in the Supabase SQL Editor.");
  });

  it("does not expose raw profile policy errors", async () => {
    const mock = storageClient({ profileError: { message: 'new row violates row-level security policy for table "profiles"' } });
    supabaseMock = mock.client;

    const result = await uploadAvatar("user-1", imageFile());

    expect(result.error).toBe("Profile photo permissions are not configured correctly. Run supabase/setup-auth.sql and supabase/setup-dashboard-data.sql in Supabase.");
  });
});
