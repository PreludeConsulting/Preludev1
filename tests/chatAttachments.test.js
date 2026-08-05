import { describe, expect, it } from "vitest";
import {
  attachmentPreviewLabel,
  attachmentTypeLabel,
  chatMessagePreviewText,
  formatAttachmentSize,
  isImageAttachment,
  normalizeChatAttachment,
  sanitizeThreadPreview
} from "../src/lib/chatAttachments.js";
import { mapChatMessage } from "../src/lib/chatService.js";

const STORAGE_KEY = "11111111-1111-4111-8111-111111111111/thread-a/1754400000000-photo.png";
const SIGNED_URL =
  "https://proj.supabase.co/storage/v1/object/sign/message-attachments/" + STORAGE_KEY + "?token=abc";

describe("normalizeChatAttachment", () => {
  it("keeps a storage key out of the renderable url", () => {
    const attachment = normalizeChatAttachment({ attachment_url: STORAGE_KEY });
    expect(attachment.attachmentPath).toBe(STORAGE_KEY);
    expect(attachment.attachmentUrl).toBeNull();
  });

  it("treats a signed url as renderable and keeps the explicit path", () => {
    const attachment = normalizeChatAttachment({
      attachment_url: SIGNED_URL,
      attachment_path: STORAGE_KEY
    });
    expect(attachment.attachmentUrl).toBe(SIGNED_URL);
    expect(attachment.attachmentPath).toBe(STORAGE_KEY);
  });

  it("accepts data urls used by demo and offline uploads", () => {
    const attachment = normalizeChatAttachment({ attachment_url: "data:image/png;base64,AAAA" });
    expect(attachment.attachmentUrl).toBe("data:image/png;base64,AAAA");
    expect(attachment.attachmentPath).toBeNull();
  });

  it("reads camelCase and snake_case rows identically", () => {
    const snake = normalizeChatAttachment({
      attachment_url: SIGNED_URL,
      attachment_name: "report.pdf",
      attachment_mime: "application/pdf",
      attachment_size: 2048
    });
    const camel = normalizeChatAttachment({
      attachmentUrl: SIGNED_URL,
      attachmentName: "report.pdf",
      attachmentMime: "application/pdf",
      attachmentSize: 2048
    });
    expect(snake).toEqual(camel);
  });

  it("derives a name and mime from the storage key when the row lacks them", () => {
    const attachment = normalizeChatAttachment({ attachment_url: STORAGE_KEY });
    expect(attachment.attachmentName).toBe("photo.png");
    expect(attachment.attachmentMime).toBe("image/png");
  });

  it("returns empty fields for a message with no attachment", () => {
    expect(normalizeChatAttachment({ body: "hi" })).toEqual({
      attachmentPath: null,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null
    });
  });

  it("is idempotent when applied to an already-mapped message", () => {
    const once = normalizeChatAttachment({ attachment_url: SIGNED_URL, attachment_path: STORAGE_KEY });
    expect(normalizeChatAttachment(once)).toEqual(once);
  });
});

describe("attachment classification", () => {
  it("detects images by mime and by extension", () => {
    expect(isImageAttachment(normalizeChatAttachment({ attachment_url: SIGNED_URL, attachment_mime: "image/png" }))).toBe(true);
    expect(isImageAttachment(normalizeChatAttachment({ attachment_url: STORAGE_KEY }))).toBe(true);
    expect(
      isImageAttachment(normalizeChatAttachment({ attachment_url: SIGNED_URL, attachment_name: "report.pdf", attachment_mime: "application/pdf" }))
    ).toBe(false);
  });

  it("labels the file type and size", () => {
    const pdf = normalizeChatAttachment({
      attachment_url: SIGNED_URL,
      attachment_name: "report.pdf",
      attachment_mime: "application/pdf",
      attachment_size: 1536
    });
    expect(attachmentTypeLabel(pdf)).toBe("PDF");
    expect(formatAttachmentSize(pdf.attachmentSize)).toBe("2 KB");
    expect(formatAttachmentSize(null)).toBe("");
  });
});

describe("conversation previews", () => {
  it("shows Photo for an image-only message", () => {
    expect(attachmentPreviewLabel({ attachment_url: STORAGE_KEY })).toBe("Photo");
  });

  it("shows the filename for a document", () => {
    expect(
      attachmentPreviewLabel({ attachment_url: SIGNED_URL, attachment_name: "report.pdf", attachment_mime: "application/pdf" })
    ).toBe("File: report.pdf");
  });

  it("prefers message text when there is text", () => {
    expect(chatMessagePreviewText({ body: "see attached", attachment_url: STORAGE_KEY })).toBe("see attached");
  });

  it("never leaks a storage key or uuid from a server preview", () => {
    expect(sanitizeThreadPreview(STORAGE_KEY)).toBe("Photo");
    expect(sanitizeThreadPreview("1754400000000-report.pdf")).toBe("File: report.pdf");
    expect(sanitizeThreadPreview("11111111-1111-4111-8111-111111111111")).toBe("");
    expect(sanitizeThreadPreview("Hi mentor")).toBe("Hi mentor");
  });
});

describe("sender and recipient parity", () => {
  const row = {
    id: "db-1",
    sender_id: "student-1",
    receiver_id: "mentor-1",
    body: "",
    created_at: "2026-08-05T12:00:00.000Z",
    attachment_url: SIGNED_URL,
    attachment_path: STORAGE_KEY,
    attachment_name: "photo.png",
    attachment_mime: "image/png",
    attachment_size: 4096
  };

  it("maps the same attachment fields for both participants", () => {
    const sender = mapChatMessage(row, "student-1");
    const recipient = mapChatMessage(row, "mentor-1");

    expect(sender.attachmentUrl).toBe(recipient.attachmentUrl);
    expect(sender.attachmentName).toBe(recipient.attachmentName);
    expect(sender.attachmentMime).toBe(recipient.attachmentMime);
    expect(sender.attachmentSize).toBe(recipient.attachmentSize);
    expect(sender.isMine).toBe(true);
    expect(recipient.isMine).toBe(false);
  });

  it("never renders a bare storage key as the image source", () => {
    const message = mapChatMessage({ ...row, attachment_url: STORAGE_KEY, attachment_path: null }, "student-1");
    expect(message.attachmentUrl).toBeNull();
    expect(message.attachmentPath).toBe(STORAGE_KEY);
  });
});
