import { api } from "./auth.js";
import { appPath } from "./appPaths.js";
import { getSupabase } from "./supabase.js";
import { getPublicAppOrigin, isSupabaseConfigured } from "./supabaseConfig.js";

/** Where Supabase should send the browser after Google OAuth completes. */
export function getGoogleOAuthRedirectTo() {
  const origin = getPublicAppOrigin() || window.location.origin;
  return `${origin}${appPath("/dashboard")}`;
}

/**
 * Start Google OAuth via Supabase when configured, otherwise legacy API placeholder.
 * @returns {{ url: string | null, error: string | null, message?: string }}
 */
export async function signInWithGoogle() {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (!supabase) {
      const message =
        "Supabase client could not be initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.";
      console.error("Google OAuth error:", message);
      return { url: null, error: message };
    }

    const redirectTo = getGoogleOAuthRedirectTo();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });

    if (error) {
      console.error("Google OAuth error:", error);
      return { url: null, error: error.message || "Google sign-in failed." };
    }

    if (data?.url) {
      return { url: data.url, error: null };
    }

    return { url: null, error: "Google sign-in did not return a redirect URL." };
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
