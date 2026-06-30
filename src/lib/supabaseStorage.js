/**
 * Supabase Storage — profile avatar uploads (public avatars bucket).
 */

import { getSupabase } from "./supabase.js";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function avatarStorageErrorMessage(error) {
  const message = error?.message || "";
  if (/bucket|not found/i.test(message)) {
    return "Avatar storage is not configured yet. Run the repo file supabase/setup-storage.sql in the Supabase SQL Editor; it starts with insert into storage.buckets.";
  }
  if (/row-level security|policy|permission|unauthorized|forbidden/i.test(message)) {
    return "Avatar storage permissions are not configured correctly. Run the repo file supabase/setup-storage.sql in the Supabase SQL Editor; it creates storage.objects policies for the avatars bucket.";
  }
  if (/mime|type|file size|payload/i.test(message)) {
    return "Use a JPG, PNG, WebP, or GIF image that is 5 MB or smaller.";
  }
  return "We could not upload your photo. Try again in a moment.";
}

function avatarProfileErrorMessage(error) {
  const message = error?.message || "";
  if (/row-level security|policy|permission|unauthorized|forbidden/i.test(message)) {
    return "Profile photo permissions are not configured correctly. Run supabase/setup-auth.sql and supabase/setup-dashboard-data.sql in Supabase.";
  }
  return "Your photo uploaded, but Prelude could not save it to your profile. Try again in a moment.";
}

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
  if (!supabase) return { url: null, error: "Supabase is not configured, so profile photo upload is unavailable." };
  const path = `${userId}/avatar.${extensionFor(file)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type
  });

  if (uploadError) return { url: null, error: avatarStorageErrorMessage(uploadError) };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) return { url: null, error: avatarProfileErrorMessage(profileError) };
  return { url: publicUrl, error: null };
}

export async function removeAvatar(userId) {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase is not configured, so profile photo removal is unavailable." };
  const { data: files } = await supabase.storage.from(BUCKET).list(userId);
  if (files?.length) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) return { error: avatarStorageErrorMessage(removeError) };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: avatarProfileErrorMessage(error) };
  return { error: null };
}
