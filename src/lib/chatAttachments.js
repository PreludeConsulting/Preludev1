/**
 * Single source of truth for chat attachment shape.
 *
 * Every message — optimistic, freshly inserted, realtime, or loaded from history —
 * is normalized here so the sender and the recipient render identical markup.
 *
 * Two fields carry the attachment location and they are never interchangeable:
 *   attachmentPath — durable storage key ("<uid>/<threadId>/<ts>-name.png"). Safe to
 *                    persist. Never renderable on its own.
 *   attachmentUrl  — something a browser can actually load (signed https, data:, blob:).
 *                    Signed URLs expire, so this is derived at read time, never stored.
 */

const RENDERABLE_URL = /^(https?:|data:|blob:)/i;
const IMAGE_MIME = /^image\//i;

const EXTENSION_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip"
};

const EXTENSION_LABEL = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/zip": "ZIP"
};

export function isRenderableAttachmentUrl(value) {
  return RENDERABLE_URL.test(String(value || "").trim());
}

export function extensionOf(value) {
  const name = String(value || "").split("?")[0].split("/").pop() || "";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

export function guessAttachmentMime(nameOrPath) {
  return EXTENSION_MIME[extensionOf(nameOrPath)] || null;
}

export function isImageAttachment(attachment) {
  if (!attachment) return false;
  if (attachment.attachmentMime) return IMAGE_MIME.test(attachment.attachmentMime);
  const guessed = guessAttachmentMime(attachment.attachmentName || attachment.attachmentPath);
  return guessed ? IMAGE_MIME.test(guessed) : false;
}

export function attachmentTypeLabel(attachment) {
  if (!attachment) return "";
  const mime = attachment.attachmentMime || guessAttachmentMime(attachment.attachmentName || attachment.attachmentPath);
  if (mime && EXTENSION_LABEL[mime]) return EXTENSION_LABEL[mime];
  const ext = extensionOf(attachment.attachmentName || attachment.attachmentPath);
  if (ext) return ext.toUpperCase();
  return mime ? mime.split("/").pop().toUpperCase() : "FILE";
}

export function formatAttachmentSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(value) {
  const raw = String(value || "").split("?")[0];
  const last = raw.split("/").pop() || "";
  // Upload keys are prefixed with an epoch timestamp; show the human name only.
  return last.replace(/^\d{10,}-/, "");
}

/**
 * Accepts a database row, a cached row, or an already-mapped message in either
 * snake_case or camelCase and returns the canonical attachment fields.
 */
export function normalizeChatAttachment(row = {}) {
  const rawLocation = row.attachment_url ?? row.attachmentUrl ?? null;
  const explicitPath = row.attachment_path ?? row.attachmentPath ?? null;

  const renderable = isRenderableAttachmentUrl(rawLocation);
  // A non-renderable location is a storage key that leaked into the URL column.
  const attachmentPath = explicitPath || (rawLocation && !renderable ? String(rawLocation).replace(/^\/+/, "") : null);
  const attachmentUrl = renderable ? String(rawLocation).trim() : null;

  if (!attachmentPath && !attachmentUrl) {
    return {
      attachmentPath: null,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null
    };
  }

  const attachmentName =
    row.attachment_name ?? row.attachmentName ?? (attachmentPath ? basename(attachmentPath) : null);
  const attachmentMime =
    row.attachment_mime ?? row.attachmentMime ?? guessAttachmentMime(attachmentName || attachmentPath) ?? null;
  const rawSize = row.attachment_size ?? row.attachmentSize;
  const size = Number(rawSize);

  return {
    attachmentPath,
    attachmentUrl,
    attachmentName,
    attachmentMime,
    attachmentSize: Number.isFinite(size) && size > 0 ? size : null
  };
}

export function hasAttachment(message) {
  return Boolean(message?.attachmentUrl || message?.attachmentPath);
}

/**
 * Conversation-list wording: never a storage key, UUID, or internal id.
 * Accepts a mapped message or a raw/cached row.
 */
export function attachmentPreviewLabel(message) {
  const attachment = normalizeChatAttachment(message || {});
  if (!hasAttachment(attachment)) return "";
  if (isImageAttachment(attachment)) return "Photo";
  const name = attachment.attachmentName ? basename(attachment.attachmentName) : "";
  return name ? `File: ${name}` : "File";
}

export function chatMessagePreviewText(message) {
  const body = String(message?.body || "").trim();
  if (body) return body;
  return attachmentPreviewLabel(message);
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Defensive filter for previews that arrive from the server. Older rows stored a
 * storage key or bare upload filename where the preview text belongs.
 */
export function sanitizeThreadPreview(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (UUID_LIKE.test(text)) return "";
  if (text.includes("/")) {
    const name = basename(text);
    if (!name) return "";
    return guessAttachmentMime(name) && IMAGE_MIME.test(guessAttachmentMime(name))
      ? "Photo"
      : `File: ${name}`;
  }
  if (/^\d{10,}-/.test(text)) {
    const name = basename(text);
    const mime = guessAttachmentMime(name);
    return mime && IMAGE_MIME.test(mime) ? "Photo" : `File: ${name}`;
  }
  return text;
}
