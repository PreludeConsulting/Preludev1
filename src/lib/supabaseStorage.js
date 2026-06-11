/**
 * Supabase Storage — profile avatar uploads (public avatars bucket).
 */

import { getSupabase } from "./supabase.js";

const BUCKET = "avatars";
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

export function validateAvatarFile(file) {
  if (!file) return "Please choose an image.";
  if (!ALLOWED_TYPES.has(file.type)) return "Use a JPG, PNG, WebP, or GIF image.";
  if (file.size > MAX_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

export async function uploadAvatar(userId, file) {
  const validation = validateAvatarFile(file);
  if (validation) return { url: null, error: validation };

  const supabase = getSupabase();
  const path = `${userId}/avatar.${extensionFor(file)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type
  });

  if (uploadError) {
    if (/bucket|not found/i.test(uploadError.message)) {
      return {
        url: null,
        error: "Avatar storage is not configured yet. Run supabase/setup-storage.sql in the Supabase SQL Editor."
      };
    }
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) return { url: null, error: profileError.message };
  return { url: publicUrl, error: null };
}

export async function removeAvatar(userId) {
  const supabase = getSupabase();
  const { data: files } = await supabase.storage.from(BUCKET).list(userId);
  if (files?.length) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { error: null };
}
