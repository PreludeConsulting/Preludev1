import cookie from "cookie";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";

const TRUSTED_DEVICE_COOKIE = "prelude_trusted_device";
const VERIFIED_LOGIN_COOKIE = "prelude_login_verified";
const CODE_TTL_MINUTES = 10;
const SEND_COOLDOWN_SECONDS = 60;
const SEND_LIMIT_PER_HOUR = 5;
const MAX_FAILED_ATTEMPTS = 5;
const TRUSTED_DEVICE_DAYS = 30;

const verifyCodeSchema = z.object({
  code: z.string().trim().regex(/^\d[\d\s-]{4,12}\d$/, "Enter the six-digit code."),
  trustDevice: z.boolean().optional(),
  deviceName: z.string().trim().max(120).optional()
});

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getSecret() {
  return process.env.LOGIN_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-login-code-secret";
}

function hashCode(userId, code) {
  return sha256(`${userId}:${code}:${getSecret()}`);
}

function hashToken(rawToken) {
  return sha256(`${rawToken}:${getSecret()}`);
}

function getClientIp(req) {
  return (req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "").trim() || "unknown";
}

function getIpHash(req) {
  return sha256(`${getClientIp(req)}:${getSecret()}`);
}

function summarizeUserAgent(userAgent = "") {
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const platform = /iPhone|iPad/i.test(userAgent)
    ? "iOS"
    : /Android/i.test(userAgent)
      ? "Android"
      : /Macintosh|Mac OS X/i.test(userAgent)
        ? "macOS"
        : /Windows/i.test(userAgent)
          ? "Windows"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "device";
  return `${browser} on ${platform}`;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

async function requireSupabaseUser(req) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error("Supabase server credentials are not configured.");
    error.statusCode = 503;
    throw error;
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }
  return { supabase, user: data.user };
}

function makeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function makeSignedLoginCookie(userId) {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const nonce = randomBytes(16).toString("base64url");
  const body = `${userId}.${expiresAt}.${nonce}`;
  return `${body}.${sha256(body + getSecret())}`;
}

function isSignedLoginCookieValid(value, userId) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const body = parts.slice(0, 3).join(".");
  const signature = parts[3];
  if (parts[0] !== userId || Number(parts[1]) <= Date.now()) return false;
  return signature === sha256(body + getSecret());
}

function serializeCookie(name, value, options = {}) {
  return cookie.serialize(name, value, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    ...options
  });
}

function clearCookie(name) {
  return serializeCookie(name, "", { maxAge: 0 });
}

async function sendCodeEmail({ to, code, req }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim() || "Prelude <no-reply@preludeconsultingllc.com>";
  if (!apiKey) {
    if (!isProduction()) console.info(`[prelude-auth:login-code] To ${to}: ${code}`);
    return { delivered: false, reason: "missing_provider", devOnly: !isProduction() };
  }

  const device = summarizeUserAgent(req.headers["user-agent"] || "");
  const issuedAt = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const logoUrl = "https://preludeconsultingllc.com/prelude-email-logo.png";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f4f0;font-family:Arial,sans-serif;color:#171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f6f4f0;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e8e2d8;border-radius:12px;padding:28px;">
  <tr><td><img src="${logoUrl}" width="72" alt="Prelude" style="display:block;margin:0 0 18px;width:72px;height:auto;">
  <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">Your Prelude verification code</h1>
  <p style="margin:0 0 18px;color:#4a4540;line-height:1.6;">Enter this code to finish signing in.</p>
  <p style="margin:0 0 18px;font-size:36px;letter-spacing:8px;font-weight:700;color:#5b21b6;">${code}</p>
  <p style="margin:0 0 10px;color:#4a4540;line-height:1.6;">This code expires in 10 minutes.</p>
  <p style="margin:0 0 10px;color:#6b645c;font-size:13px;line-height:1.5;">Requested around ${issuedAt} from ${device}.</p>
  <p style="margin:0;color:#8a7f72;font-size:12px;line-height:1.5;">If you did not try to sign in, ignore this email and consider resetting your password.</p>
  </td></tr></table></td></tr></table></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Prelude verification code",
      html
    })
  });

  if (!response.ok) return { delivered: false, reason: "provider_error" };
  return { delivered: true };
}

async function findTrustedDevice(supabase, userId, req) {
  const raw = cookie.parse(req.headers.cookie || "")[TRUSTED_DEVICE_COOKIE];
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const { data } = await supabase
    .from("trusted_devices")
    .select("id, device_name, user_agent_summary, created_at, last_used_at, expires_at, revoked_at")
    .eq("user_id", userId)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  await supabase.from("trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

async function handleCheck(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  const parsed = cookie.parse(req.headers.cookie || "");
  const trustedDevice = await findTrustedDevice(supabase, user.id, req);
  const verified = Boolean(trustedDevice || isSignedLoginCookieValid(parsed[VERIFIED_LOGIN_COOKIE], user.id));
  sendJson(res, 200, {
    verified,
    trustedDevice: Boolean(trustedDevice),
    device: trustedDevice || null
  });
}

async function handleSend(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  if (!user.email || !user.email_confirmed_at) {
    return sendJson(res, 403, { error: "email_unconfirmed", message: "Confirm your email before completing login verification." });
  }

  const sinceCooldown = new Date(Date.now() - SEND_COOLDOWN_SECONDS * 1000).toISOString();
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ data: recent }, { count: hourlyCount }] = await Promise.all([
    supabase.from("login_verification_challenges").select("id").eq("user_id", user.id).gte("created_at", sinceCooldown).limit(1),
    supabase.from("login_verification_challenges").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", sinceHour)
  ]);

  if (recent?.length) {
    return sendJson(res, 429, { error: "cooldown", message: "Please wait before requesting another code.", retryAfter: SEND_COOLDOWN_SECONDS });
  }
  if ((hourlyCount || 0) >= SEND_LIMIT_PER_HOUR) {
    return sendJson(res, 429, { error: "rate_limited", message: "Too many verification codes requested. Try again later." });
  }

  const code = makeCode();
  await supabase
    .from("login_verification_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("used_at", null);
  const { error } = await supabase.from("login_verification_challenges").insert({
    user_id: user.id,
    code_hash: hashCode(user.id, code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    requested_ip_hash: getIpHash(req),
    user_agent_summary: summarizeUserAgent(req.headers["user-agent"] || "")
  });
  if (error) return sendJson(res, 500, { error: "challenge_create_failed", message: "Could not create a verification code." });

  const delivery = await sendCodeEmail({ to: user.email, code, req });
  if (!delivery.delivered && isProduction()) {
    return sendJson(res, 503, { error: "email_delivery_failed", message: "Verification email could not be sent. Check Resend configuration." });
  }
  sendJson(res, 200, { message: "Verification code sent.", emailSent: Boolean(delivery.delivered), devOnly: Boolean(delivery.devOnly) });
}

async function handleVerify(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  const payload = verifyCodeSchema.parse(await readJsonBody(req));
  const code = payload.code.replace(/\D/g, "");
  if (code.length !== 6) return sendJson(res, 400, { error: "invalid_code", message: "Enter the six-digit code." });

  const { data: challenge } = await supabase
    .from("login_verification_challenges")
    .select("id, code_hash, expires_at, used_at, failed_attempts")
    .eq("user_id", user.id)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) return sendJson(res, 400, { error: "missing_challenge", message: "Request a new verification code." });
  if (challenge.used_at) return sendJson(res, 400, { error: "used_code", message: "This code has already been used." });
  if (new Date(challenge.expires_at) <= new Date()) return sendJson(res, 400, { error: "expired_code", message: "This code expired. Request a new one." });
  if (challenge.failed_attempts >= MAX_FAILED_ATTEMPTS) return sendJson(res, 423, { error: "locked_challenge", message: "Too many incorrect attempts. Request a new code." });

  const expected = Buffer.from(challenge.code_hash);
  const actual = Buffer.from(hashCode(user.id, code));
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!valid) {
    await supabase
      .from("login_verification_challenges")
      .update({ failed_attempts: challenge.failed_attempts + 1 })
      .eq("id", challenge.id);
    return sendJson(res, 401, { error: "incorrect_code", message: "That code is not correct." });
  }

  const cookies = [serializeCookie(VERIFIED_LOGIN_COOKIE, makeSignedLoginCookie(user.id), { maxAge: 12 * 60 * 60 })];
  await supabase.from("login_verification_challenges").update({ used_at: new Date().toISOString() }).eq("id", challenge.id);

  let trustedDevice = null;
  if (payload.trustDevice) {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const deviceName = payload.deviceName || summarizeUserAgent(req.headers["user-agent"] || "");
    const { data } = await supabase
      .from("trusted_devices")
      .insert({
        user_id: user.id,
        token_hash: hashToken(rawToken),
        device_name: deviceName,
        user_agent_summary: summarizeUserAgent(req.headers["user-agent"] || ""),
        expires_at: expiresAt,
        last_used_at: new Date().toISOString()
      })
      .select("id, device_name, user_agent_summary, created_at, last_used_at, expires_at")
      .maybeSingle();
    trustedDevice = data;
    cookies.push(serializeCookie(TRUSTED_DEVICE_COOKIE, rawToken, { maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60 }));
  }

  sendJson(res, 200, { verified: true, trustedDevice }, { "Set-Cookie": cookies });
}

async function handleListDevices(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id, device_name, user_agent_summary, created_at, last_used_at, expires_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return sendJson(res, 500, { error: "device_list_failed", message: "Could not load trusted devices." });
  sendJson(res, 200, { devices: data || [] });
}

async function handleRevoke(req, res, url) {
  const { supabase, user } = await requireSupabaseUser(req);
  const id = url.pathname.split("/").pop();
  const now = new Date().toISOString();
  if (id === "others") {
    const current = await findTrustedDevice(supabase, user.id, req);
    let query = supabase.from("trusted_devices").update({ revoked_at: now }).eq("user_id", user.id).is("revoked_at", null);
    if (current?.id) query = query.neq("id", current.id);
    await query;
    return sendJson(res, 200, { message: "Other trusted devices revoked." });
  }
  await supabase.from("trusted_devices").update({ revoked_at: now }).eq("id", id).eq("user_id", user.id);
  sendJson(res, 200, { message: "Trusted device revoked." }, { "Set-Cookie": [clearCookie(TRUSTED_DEVICE_COOKIE), clearCookie(VERIFIED_LOGIN_COOKIE)] });
}

export function createSupabaseLoginVerificationMiddleware() {
  return async function supabaseLoginVerificationMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    const matches =
      pathname.startsWith("/api/auth/login-verification") ||
      pathname === "/api/auth/trusted-devices" ||
      pathname.startsWith("/api/auth/trusted-devices/");
    if (!matches) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      if (pathname === "/api/auth/login-verification/check" && req.method === "GET") return await handleCheck(req, res);
      if (pathname === "/api/auth/login-verification/send" && req.method === "POST") return await handleSend(req, res);
      if (pathname === "/api/auth/login-verification/verify" && req.method === "POST") return await handleVerify(req, res);
      if (pathname === "/api/auth/trusted-devices" && req.method === "GET") return await handleListDevices(req, res);
      if (pathname.startsWith("/api/auth/trusted-devices/") && req.method === "DELETE") return await handleRevoke(req, res, url);
      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-supabase-login-verification]", error);
      return sendJson(res, statusCode, {
        error: statusCode >= 500 ? "server_error" : "request_failed",
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createSupabaseLoginVerificationMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
