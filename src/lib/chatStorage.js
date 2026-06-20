/**
 * Chat image uploads (Supabase Storage message-attachments bucket).
 */

import { getSupabase } from "./supabase.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";

const BUCKET = "message-attachments";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFor(file) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return map[file.type] || "jpg";
}

export function validateChatImageFile(file) {
  if (!file) return "Please choose an image.";
  if (!ALLOWED_TYPES.has(file.type)) return "Use a JPG, PNG, WebP, or GIF image.";
  if (file.size > MAX_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadChatAttachment(userId, threadId, file) {
  const validation = validateChatImageFile(file);
  if (validation) return { url: null, mime: null, name: null, error: validation };

  const safeName = (file.name || `photo.${extensionFor(file)}`).replace(/[^\w.-]+/g, "_");

  if (!isSupabaseConfigured()) {
    try {
      const dataUrl = await fileToDataUrl(file);
      return { url: dataUrl, mime: file.type, name: safeName, error: null };
    } catch {
      return { url: null, mime: null, name: null, error: "Could not read image file." };
    }
  }

  const supabase = getSupabase();
  if (!supabase) return { url: null, mime: null, name: null, error: "Supabase is not configured." };

  const path = `${userId}/${threadId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: "3600",
    contentType: file.type
  });

  if (uploadError) {
    if (/bucket|not found/i.test(uploadError.message)) {
      return {
        url: null,
        mime: null,
        name: null,
        error: "Message attachment storage is not configured. Run supabase/chat-messaging.sql in Supabase."
      };
    }
    return { url: null, mime: null, name: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    url: data?.publicUrl || null,
    mime: file.type,
    name: safeName,
    error: null
  };
}
