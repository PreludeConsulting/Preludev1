/**
 * Chat image uploads (Supabase Storage message-attachments bucket).
 */

import { getSupabase } from "./supabase.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";
import { isDemoEmail } from "../data/demoAccounts.js";
import { shouldUseDemoFixtures } from "./devAuthBypass.js";

const BUCKET = "message-attachments";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const LEGACY_PUBLIC_PATH = "/storage/v1/object/public/message-attachments/";

const EXTENSION_TO_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

function extensionFor(file) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return map[file.type] || "jpg";
}

export function resolveChatImageMime(file) {
  if (file?.type && ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = (file?.name || "").split(".").pop()?.toLowerCase();
  return EXTENSION_TO_MIME[ext] || null;
}

function shouldUseLocalAttachments(user) {
  if (!isSupabaseConfigured()) return true;
  if (!user) return true;
  if (user.authProvider === "demo" || user.authProvider === "dev") return true;
  if (shouldUseDemoFixtures(user)) return true;
  if (user.email && isDemoEmail(user.email)) return true;
  return false;
}

export function validateChatImageFile(file) {
  if (!file) return "Please choose an image.";
  if (!resolveChatImageMime(file)) return "Use a JPG, PNG, WebP, or GIF image.";
  if (file.size > MAX_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

export function normalizeChatAttachmentStoragePath(value) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.startsWith("data:") || candidate.startsWith("blob:")) return null;
  if (!/^https?:\/\//i.test(candidate)) return candidate.replace(/^\/+/, "");
  try {
    const url = new URL(candidate);
    const markerIndex = url.pathname.indexOf(LEGACY_PUBLIC_PATH);
    return markerIndex >= 0
      ? decodeURIComponent(url.pathname.slice(markerIndex + LEGACY_PUBLIC_PATH.length))
      : null;
  } catch {
    return null;
  }
}

export async function createPrivateChatAttachmentUrl(value, supabase = getSupabase()) {
  if (!value || String(value).startsWith("data:") || String(value).startsWith("blob:")) return value || null;
  const path = normalizeChatAttachmentStoragePath(value);
  if (!path || !supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadChatAttachment(user, threadId, file) {
  const validation = validateChatImageFile(file);
  if (validation) return { url: null, mime: null, name: null, error: validation };

  const mime = resolveChatImageMime(file);
  const safeName = (file.name || `photo.${extensionFor({ type: mime })}`).replace(/[^\w.-]+/g, "_");

  if (shouldUseLocalAttachments(user)) {
    try {
      const dataUrl = await fileToDataUrl(file);
      return { url: dataUrl, mime, name: safeName, error: null };
    } catch {
      return { url: null, mime: null, name: null, error: "Could not read image file." };
    }
  }

  const supabase = getSupabase();
  if (!supabase) return { url: null, mime: null, name: null, error: "Supabase is not configured." };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const storageUserId = authData?.user?.id || user?.id;
  if (!storageUserId) {
    return { url: null, mime: null, name: null, error: "Sign in again to attach photos." };
  }
  if (authError && !storageUserId) {
    return { url: null, mime: null, name: null, error: authError.message };
  }

  const path = `${storageUserId}/${threadId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: "3600",
    contentType: mime || file.type || "image/jpeg"
  });

  if (uploadError) {
    if (/bucket|not found/i.test(uploadError.message)) {
      return {
        url: null,
        path: null,
        mime: null,
        name: null,
        error: "Message attachment storage is not configured. Run supabase/chat-messaging.sql in Supabase."
      };
    }
    return { url: null, path: null, mime: null, name: null, error: uploadError.message };
  }

  const url = await createPrivateChatAttachmentUrl(path, supabase);
  if (!url) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { url: null, path: null, mime: null, name: null, error: "Could not secure the uploaded image." };
  }
  return {
    url,
    path,
    mime: mime || file.type,
    name: safeName,
    error: null
  };
}
