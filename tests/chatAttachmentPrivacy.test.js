import { describe, expect, it } from "vitest";
import { normalizeChatAttachmentStoragePath } from "../src/lib/chatStorage.js";

describe("private chat attachment paths", () => {
  it("keeps canonical private storage paths", () => {
    expect(normalizeChatAttachmentStoragePath("user-1/thread-1/photo.png"))
      .toBe("user-1/thread-1/photo.png");
  });

  it("migrates legacy public bucket URLs back to a private path", () => {
    expect(normalizeChatAttachmentStoragePath(
      "https://project.supabase.co/storage/v1/object/public/message-attachments/user-1/thread-1/photo.png"
    )).toBe("user-1/thread-1/photo.png");
  });

  it("does not reinterpret local data URLs or unrelated remote URLs", () => {
    expect(normalizeChatAttachmentStoragePath("data:image/png;base64,abc")).toBeNull();
    expect(normalizeChatAttachmentStoragePath("https://example.com/photo.png")).toBeNull();
  });
});
