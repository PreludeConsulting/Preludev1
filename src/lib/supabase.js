/**
 * Supabase browser client (public credentials only).
 * Returns null when env vars are missing — never crashes the app shell.
 */

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabaseConfig.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl?.trim() || !supabaseKey?.trim()) {
  console.error("Missing Supabase environment variables.");
}

let client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return client;
}

function requireSupabase() {
  const instance = getSupabase();
  if (!instance) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return instance;
}

/** @deprecated Prefer getSupabase() — kept for modules that already import `supabase`. */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = requireSupabase();
      const value = instance[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    }
  }
);
