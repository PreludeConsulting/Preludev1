/**
 * Password recovery link helpers — keep email links on /reset-password with token_hash
 * instead of Supabase action_link (avoids prefetch consuming OTP + wrong-site redirects).
 */

export function buildPasswordResetEmailUrl(baseUrl, properties = {}) {
  const origin = String(baseUrl || "").replace(/\/$/, "");
  const hashedToken = properties.hashed_token;
  if (origin && hashedToken) {
    const url = new URL(`${origin}/reset-password`);
    url.searchParams.set("token_hash", hashedToken);
    url.searchParams.set("type", "recovery");
    return url.toString();
  }
  return properties.action_link || null;
}

function parseHashParams(hash = "") {
  return new URLSearchParams(String(hash || "").replace(/^#/, ""));
}

function isRecoveryContext(params) {
  const type = (params.get("type") || "").toLowerCase();
  return type === "recovery" || params.get("error_code") === "otp_expired";
}

/**
 * When Supabase rejects a redirect or the link is consumed, users often land on `/`
 * with `#error=...`. Send them to the reset page (or callback) with query params.
 */
export function resolveAuthLandingRedirect({ pathname = "/", search = "", hash = "" } = {}) {
  if (pathname !== "/") return null;

  const hashParams = parseHashParams(hash);
  const searchParams = new URLSearchParams(String(search || "").replace(/^\?/, ""));

  if (hashParams.get("error") || hashParams.get("error_code")) {
    const query = hashParams.toString();
    if (isRecoveryContext(hashParams) || hashParams.get("error_code") === "otp_expired") {
      return `/reset-password?${query}`;
    }
    return `/auth/callback?${query}`;
  }

  if (hashParams.get("token_hash") && isRecoveryContext(hashParams)) {
    return `/reset-password?${hashParams.toString()}`;
  }

  if (hashParams.get("access_token") && isRecoveryContext(hashParams)) {
    return `/reset-password${search}${hash}`;
  }

  if (searchParams.get("code")) {
    return `/reset-password${search}`;
  }

  return null;
}
