import { api } from "./auth.js";

/** Placeholder until Google OAuth is configured on the server. */
export async function startGoogleSignIn() {
  try {
    return await api("/api/auth/google/start", { method: "POST" });
  } catch (error) {
    if (error.status === 404) {
      return {
        message:
          "Google sign-in will be available once OAuth is configured. Use email and password for now."
      };
    }
    throw error;
  }
}
