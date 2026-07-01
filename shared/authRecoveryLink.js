/**
 * Password recovery link helpers — keep email links on /reset-password with token_hash
 * instead of Supabase action_link (avoids prefetch consuming OTP + wrong-site redirects).
 */

export function normalizeGenerateLinkProperties(data) {
  if (!data || typeof data !== "object") return {};
  const properties = data.properties && typeof data.properties === "object" ? data.properties : {};
  return { ...properties, ...data };
}

export function extractRecoveryToken(properties = {}) {
  const direct = properties.hashed_token || properties.hashedToken || properties.token_hash;
  if (direct) return String(direct).trim();

  const actionLink = properties.action_link || properties.actionLink;
  if (!actionLink) return "";

  try {
    const url = new URL(String(actionLink));
    return (url.searchParams.get("token_hash") || url.searchParams.get("token") || "").trim();
  } catch {
    return "";
  }
}

export function buildPasswordResetEmailUrl(baseUrl, properties = {}) {
  const origin = String(baseUrl || "").replace(/\/$/, "");
  const token = extractRecoveryToken(properties);
  if (!origin || !token) return null;

  const url = new URL(`${origin}/reset-password`);
  url.searchParams.set("token_hash", token);
  url.searchParams.set("type", "recovery");
  return url.toString();
}

function parseHashParams(hash = "") {
  return new URLSearchParams(String(hash || "").replace(/^#/, ""));
}

function parseSearchParams(search = "") {
  return new URLSearchParams(String(search || "").replace(/^\?/, ""));
}

function isRecoveryContext(params) {
  const type = (params.get("type") || "").toLowerCase();
  return type === "recovery" || params.get("error_code") === "otp_expired";
}

function buildRecoveryPageTarget(pathname = "/", search = "", hash = "") {
  const searchParams = parseSearchParams(search);
  const hashParams = parseHashParams(hash);
  const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
  const type = (searchParams.get("type") || hashParams.get("type") || "").toLowerCase();

  // Supabase often redirects recovery sessions to Site URL (/) with token_hash in the query.
  if (pathname !== "/reset-password" && tokenHash && (type === "recovery" || isRecoveryContext(searchParams) || isRecoveryContext(hashParams))) {
    if (searchParams.get("token_hash")) {
      const params = new URLSearchParams(searchParams);
      if (!params.get("type")) params.set("type", "recovery");
      return `/reset-password?${params.toString()}`;
    }
    if (hashParams.get("token_hash")) {
      const params = new URLSearchParams(hashParams);
      if (!params.get("type")) params.set("type", "recovery");
      return `/reset-password?${params.toString()}`;
    }
  }

  if (searchParams.get("token_hash") && isRecoveryContext(searchParams)) {
    return `/reset-password?${searchParams.toString()}`;
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

/**
 * Run before React boots (see index.html) to avoid flashing the marketing homepage.
 */
export function bootstrapAuthRecoveryRedirect(pathname = "/", search = "", hash = "") {
  if (pathname === "/reset-password") return null;
  return buildRecoveryPageTarget(pathname, search, hash);
}

/**
 * When Supabase rejects a redirect or the link is consumed, users often land on `/`
 * with `#error=...`. Send them to the reset page (or callback) with query params.
 */
export function resolveAuthLandingRedirect({ pathname = "/", search = "", hash = "" } = {}) {
  const recoveryTarget = buildRecoveryPageTarget(pathname, search, hash);
  if (recoveryTarget && pathname !== "/reset-password") {
    return recoveryTarget;
  }

  if (pathname !== "/") return null;

  const hashParams = parseHashParams(hash);
  const searchParams = parseSearchParams(search);

  if (hashParams.get("error") || hashParams.get("error_code")) {
    const query = hashParams.toString();
    if (isRecoveryContext(hashParams) || hashParams.get("error_code") === "otp_expired") {
      return `/reset-password?${query}`;
    }
    return `/auth/callback?${query}`;
  }

  if (searchParams.get("error") || searchParams.get("error_code")) {
    const query = searchParams.toString();
    if (isRecoveryContext(searchParams) || searchParams.get("error_code") === "otp_expired") {
      return `/reset-password?${query}`;
    }
    return `/auth/callback?${query}`;
  }

  return null;
}
