import { api } from "./auth.js";
import { appPath } from "./appPaths.js";
import { sanitizeAuthRedirect } from "./authRedirects.js";
import { getPublicAppUrl, isSupabaseConfigured } from "./supabaseConfig.js";

/** Where Supabase should send the browser after Google OAuth completes. */
export function getGoogleOAuthRedirectTo(next = "") {
  const origin = getPublicAppUrl() || window.location.origin;
  const safeNext = sanitizeAuthRedirect(next, "");
  const query = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
  return `${origin}${appPath(`/auth/callback${query}`)}`;
}

/**
 * Start Google OAuth via Supabase when configured, otherwise legacy API placeholder.
 * @returns {{ url: string | null, error: string | null, message?: string }}
 */
export async function signInWithGoogle(options = {}) {
  if (isSupabaseConfigured()) {
    const { signInWithOAuth } = await import("./supabaseAuth.js");
    return signInWithOAuth("google", options);
  }

  try {
    const result = await api("/api/auth/google/start", { method: "POST" });
    if (result?.url) return { url: result.url, error: null };
    return {
      url: null,
      error: null,
      message: result?.message || "Google sign-in will be available once OAuth is configured. Use email and password for now."
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        url: null,
        error: null,
        message:
          "Google sign-in will be available once OAuth is configured. Use email and password for now."
      };
    }
    console.error("Unexpected Google OAuth failure:", error);
    return {
      url: null,
      error: error?.message || "Request failed. Check Supabase/Google OAuth settings."
    };
  }
}

/** @deprecated Use signInWithGoogle — kept for existing imports. */
export async function startGoogleSignIn() {
  const result = await signInWithGoogle();
  if (result.error) throw new Error(result.error);
  return { url: result.url, message: result.message };
}
