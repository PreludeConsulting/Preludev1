/** True when both public Supabase client env vars are set (safe to check anywhere). */
export function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export function getMissingSupabaseEnvVars() {
  const missing = [];
  if (!import.meta.env.VITE_SUPABASE_URL?.trim()) missing.push("VITE_SUPABASE_URL");
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  return missing;
}

export function getSupabaseConfigError() {
  const missing = getMissingSupabaseEnvVars();
  if (!missing.length) return "";
  return `Supabase is not configured. Missing ${missing.join(" and ")}.`;
}

/** Public site origin for auth email redirects (no trailing slash). */
export function getPublicAppOrigin() {
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}
