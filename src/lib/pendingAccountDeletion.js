/**
 * Resume OAuth-verified account deletion after redirect.
 */

import { isSupabaseConfigured } from "./supabaseConfig.js";
import {
  clearPendingOAuthAccountDeletion,
  readPendingOAuthAccountDeletion
} from "./accountDeletionFlow.js";

export function readOAuthDeletionRedirectError(search = "", hash = "") {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    searchParams.get("error")
    || searchParams.get("error_description")
    || hashParams.get("error")
    || hashParams.get("error_description")
    || null
  );
}

export async function resumePendingOAuthAccountDeletion({
  user,
  search = "",
  hash = "",
  deleteAccount
}) {
  if (!isSupabaseConfigured() || !user?.id) {
    return { handled: false };
  }

  const pending = readPendingOAuthAccountDeletion();
  if (!pending) return { handled: false };

  const oauthError = readOAuthDeletionRedirectError(search, hash);
  if (oauthError) {
    clearPendingOAuthAccountDeletion();
    throw new Error("Google verification was cancelled or failed. Your account was not deleted.");
  }

  if (pending.userId !== user.id) {
    clearPendingOAuthAccountDeletion();
    throw new Error("Google verification did not match your account. Account was not deleted.");
  }

  await deleteAccount({ verificationMethod: "oauth" });
  return { handled: true };
}
