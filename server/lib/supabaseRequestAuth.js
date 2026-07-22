import { createClient } from "@supabase/supabase-js";
import { requireLoginAssurance } from "./loginAssurance.js";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey };
}

export function getSupabaseAdmin() {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function getSupabaseForUser(accessToken) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export async function requireSupabaseUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseForUser(token);
  if (!supabase) {
    const error = new Error("Supabase is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }

  await requireLoginAssurance({
    req,
    userId: data.user.id,
    admin: getSupabaseAdmin(),
    env: process.env
  });

  return { supabase, user: data.user };
}
