/**
 * Supabase browser client (public credentials only).
 * Use getSupabase() after checking isSupabaseConfigured().
 */

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabaseConfig.js";

let client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      [
        "Supabase is not configured.",
        "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart npm run dev.",
        "See SUPABASE_AUTH_MANUAL_SETUP.md."
      ].join("\n")
    );
  }
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return client;
}

/** @deprecated Prefer getSupabase() — kept for modules that already import `supabase`. */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return getSupabase()[prop];
    }
  }
);
