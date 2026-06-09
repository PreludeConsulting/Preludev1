/** True when both public Supabase client env vars are set (safe to check anywhere). */
export function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}
