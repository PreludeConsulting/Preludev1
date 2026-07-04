/**
 * Derive how the user signs in (email/password vs OAuth) from session identity data.
 * Used to show the correct account-deletion verification flow.
 */

const OAUTH_PROVIDERS = new Set(["google", "apple", "github", "azure", "facebook", "discord", "twitter"]);

export function normalizeAuthProviders(identities = [], sessionUser = null) {
  const providers = new Set();

  for (const identity of identities) {
    if (identity?.provider) providers.add(identity.provider);
  }

  const metaProvider = sessionUser?.app_metadata?.provider;
  if (metaProvider) providers.add(metaProvider);

  const metaProviders = sessionUser?.app_metadata?.providers;
  if (Array.isArray(metaProviders)) {
    metaProviders.forEach((provider) => {
      if (provider) providers.add(provider);
    });
  }

  if (!providers.size) {
    providers.add("email");
  }

  return [...providers];
}

export function resolveAuthSignInMethods(user, sessionUser = null) {
  if (!user) return [];
  if (user.authProvider === "demo" || user.authProvider === "dev") return ["demo"];

  if (sessionUser) {
    return normalizeAuthProviders(sessionUser.identities || [], sessionUser);
  }

  if (Array.isArray(user.authSignInMethods) && user.authSignInMethods.length) {
    return user.authSignInMethods;
  }

  if (user.oauthAvatarUrl || user.oauthAvatar_url) {
    return ["google"];
  }

  if (user.authProvider !== "supabase") return ["email"];
  return ["email"];
}

export function accountDeletionUsesPassword(methods = []) {
  if (methods.includes("demo")) return false;
  return methods.includes("email");
}

export function accountDeletionUsesOAuth(methods = []) {
  if (methods.includes("demo")) return false;
  if (methods.includes("email")) return false;
  return methods.some((provider) => OAUTH_PROVIDERS.has(provider));
}

export function primaryOAuthProvider(methods = []) {
  return methods.find((provider) => OAUTH_PROVIDERS.has(provider)) || "google";
}

export function accountDeletionVerificationLabel(methods = []) {
  if (accountDeletionUsesPassword(methods)) return "password";
  if (accountDeletionUsesOAuth(methods)) return "oauth";
  return "password";
}
