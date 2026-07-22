import cookie from "cookie";
import { createHash } from "node:crypto";

export const TRUSTED_DEVICE_COOKIE = "prelude_trusted_device";
export const LOGIN_ASSURANCE_COOKIE = "prelude_login_assurance";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function getLoginVerificationSecret(env = process.env) {
  const secret = env.LOGIN_CODE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw Object.assign(new Error("Login verification is not configured."), {
      statusCode: 503,
      code: "login_verification_not_configured"
    });
  }
  return "dev-only-login-code-secret";
}

export function hashLoginToken(rawToken, env = process.env) {
  return sha256(`${rawToken}:${getLoginVerificationSecret(env)}`);
}

export function createSessionReference(authorization = "") {
  return authorization ? sha256(String(authorization).slice(-64)) : null;
}

function verificationError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

async function findActiveToken(admin, table, userId, hashColumn, tokenHash) {
  const { data, error } = await admin
    .from(table)
    .select("id, session_reference")
    .eq("user_id", userId)
    .eq(hashColumn, tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw verificationError(503, "login_verification_unavailable", "Login verification is temporarily unavailable.");
  return data || null;
}

export async function requireLoginAssurance({ req, userId, admin, env = process.env }) {
  if (env.NODE_ENV !== "production") return { verified: true, method: "not_required" };
  if (!admin) throw verificationError(503, "login_verification_not_configured", "Login verification is not configured.");

  const cookies = cookie.parse(req.headers?.cookie || "");
  const trustedToken = cookies[TRUSTED_DEVICE_COOKIE];
  if (trustedToken) {
    const trusted = await findActiveToken(admin, "trusted_devices", userId, "token_hash", hashLoginToken(trustedToken, env));
    if (trusted) return { verified: true, method: "trusted_device", id: trusted.id };
  }

  const assuranceToken = cookies[LOGIN_ASSURANCE_COOKIE];
  if (assuranceToken) {
    const assurance = await findActiveToken(
      admin,
      "login_assurances",
      userId,
      "assurance_token_hash",
      hashLoginToken(assuranceToken, env)
    );
    const expectedSession = createSessionReference(req.headers?.authorization || "");
    if (assurance && assurance.session_reference && assurance.session_reference === expectedSession) {
      return { verified: true, method: "assurance", id: assurance.id };
    }
  }

  throw verificationError(403, "login_verification_required", "Complete login verification to continue.");
}
