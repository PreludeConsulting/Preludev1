import cookie from "cookie";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";

const TRUSTED_DEVICE_COOKIE = "prelude_trusted_device";
const LOGIN_ASSURANCE_COOKIE = "prelude_login_assurance";
const CODE_TTL_MINUTES = 10;
const SEND_COOLDOWN_SECONDS = 60;
const SEND_LIMIT_PER_HOUR = 5;
const MAX_FAILED_ATTEMPTS = 5;
const TRUSTED_DEVICE_DAYS = 30;

const verifyCodeSchema = z.object({
  challengeId: z.string().uuid().optional(),
  code: z.string().trim().regex(/^\d[\d\s-]{4,12}\d$/, "Enter the six-digit code."),
  trustDevice: z.boolean().optional(),
  deviceName: z.string().trim().max(120).optional()
});

function correlationId() {
  return randomBytes(12).toString("hex");
}

function recipientDomain(email = "") {
  return email.includes("@") ? email.split("@").pop().toLowerCase() : "unknown";
}

function logAuth(event, details = {}) {
  const safe = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };
  console.info("[prelude-auth]", JSON.stringify(safe));
}

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

async function sendCodeEmail({ to, code, req, challengeId, requestId }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim() || "Prelude <no-reply@preludeconsultingllc.com>";
  logAuth("verification.email.requested", {
    requestId,
    challengeId,
    recipientDomain: recipientDomain(to)
  });
  if (!apiKey) {
    logAuth("verification.email.failed", { requestId, challengeId, reason: "missing_provider" });
    return { delivered: false, reason: "missing_provider" };
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

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logAuth("verification.email.failed", {
      requestId,
      challengeId,
      resendStatus: response.status,
      reason: body?.name || body?.message || "provider_error"
    });
    return { delivered: false, reason: "provider_error", status: response.status };
  }
  logAuth("verification.email.accepted", {
    requestId,
    challengeId,
    resendStatus: response.status,
    resendMessageId: body?.id || null
  });
  return { delivered: true, messageId: body?.id || null };
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
  logAuth("trusted_device.accepted", { userId, trustedDeviceId: data.id });
  return data;
}

async function findLoginAssurance(supabase, userId, req) {
  const raw = cookie.parse(req.headers.cookie || "")[LOGIN_ASSURANCE_COOKIE];
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const { data } = await supabase
    .from("login_assurances")
    .select("id, user_id, expires_at, revoked_at, trusted_device_id")
    .eq("user_id", userId)
    .eq("assurance_token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data || null;
}

async function handleCheck(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  const trustedDevice = await findTrustedDevice(supabase, user.id, req);
  const assurance = trustedDevice ? null : await findLoginAssurance(supabase, user.id, req);
  const verified = Boolean(trustedDevice || assurance);
  sendJson(res, 200, {
    verified,
    trustedDevice: Boolean(trustedDevice),
    device: trustedDevice || null,
    assuranceId: assurance?.id || null
  });
}

async function handleSend(req, res) {
  const requestId = correlationId();
  const { supabase, user } = await requireSupabaseUser(req);
  logAuth("verification.challenge.create.started", { requestId, userId: user.id });
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
  const { data: challenge, error } = await supabase.from("login_verification_challenges").insert({
    user_id: user.id,
    code_hash: hashCode(user.id, code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    requested_ip_hash: getIpHash(req),
    user_agent_summary: summarizeUserAgent(req.headers["user-agent"] || ""),
    delivery_status: "pending"
  }).select("id, expires_at").maybeSingle();
  if (error) return sendJson(res, 500, { error: "challenge_create_failed", message: "Could not create a verification code." });
  logAuth("verification.challenge.created", { requestId, userId: user.id, challengeId: challenge.id });

  const delivery = await sendCodeEmail({ to: user.email, code, req, challengeId: challenge.id, requestId });
  await supabase
    .from("login_verification_challenges")
    .update({
      delivery_status: delivery.delivered ? "accepted" : delivery.reason || "failed",
      resend_message_id: delivery.messageId || null
    })
    .eq("id", challenge.id);
  if (!delivery.delivered) {
    return sendJson(res, 503, { error: "email_delivery_failed", message: "Verification email could not be sent. Check Resend configuration." });
  }
  sendJson(res, 200, {
    challengeId: challenge.id,
    expiresAt: challenge.expires_at,
    resendMessageId: delivery.messageId || null,
    message: "Verification code sent.",
    emailSent: true
  });
}

async function handleVerify(req, res) {
  const requestId = correlationId();
  const { supabase, user } = await requireSupabaseUser(req);
  const payload = verifyCodeSchema.parse(await readJsonBody(req));
  const code = payload.code.replace(/\D/g, "");
  if (code.length !== 6) return sendJson(res, 400, { error: "invalid_code", message: "Enter the six-digit code." });

  let selectedChallenge = null;
  if (payload.challengeId) {
    const { data } = await supabase
      .from("login_verification_challenges")
      .select("id, code_hash, expires_at, used_at, failed_attempts, locked_at")
      .eq("id", payload.challengeId)
      .eq("user_id", user.id)
      .maybeSingle();
    selectedChallenge = data;
  } else {
    const { data } = await supabase
      .from("login_verification_challenges")
      .select("id, code_hash, expires_at, used_at, failed_attempts, locked_at")
      .eq("user_id", user.id)
      .is("used_at", null)
      .is("locked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    selectedChallenge = data;
  }

  if (!selectedChallenge) return sendJson(res, 400, { error: "missing_challenge", message: "Request a new verification code." });
  if (selectedChallenge.used_at) return sendJson(res, 400, { error: "used_code", message: "This code has already been used." });
  if (new Date(selectedChallenge.expires_at) <= new Date()) {
    logAuth("verification.challenge.expired", { requestId, userId: user.id, challengeId: selectedChallenge.id });
    return sendJson(res, 400, { error: "expired_code", message: "This code expired. Request a new one." });
  }
  if (selectedChallenge.locked_at || selectedChallenge.failed_attempts >= MAX_FAILED_ATTEMPTS) return sendJson(res, 423, { error: "locked_challenge", message: "Too many incorrect attempts. Request a new code." });

  const expected = Buffer.from(selectedChallenge.code_hash);
  const actual = Buffer.from(hashCode(user.id, code));
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!valid) {
    const failedAttempts = selectedChallenge.failed_attempts + 1;
    await supabase
      .from("login_verification_challenges")
      .update({
        failed_attempts: failedAttempts,
        locked_at: failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date().toISOString() : null
      })
      .eq("id", selectedChallenge.id);
    logAuth("verification.challenge.rejected", { requestId, userId: user.id, challengeId: selectedChallenge.id, failedAttempts });
    return sendJson(res, 401, { error: "incorrect_code", message: "That code is not correct." });
  }

  await supabase.from("login_verification_challenges").update({ used_at: new Date().toISOString() }).eq("id", selectedChallenge.id);

  let trustedDevice = null;
  let rawTrustedDeviceToken = null;
  if (payload.trustDevice) {
    rawTrustedDeviceToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const deviceName = payload.deviceName || summarizeUserAgent(req.headers["user-agent"] || "");
    const { data } = await supabase
      .from("trusted_devices")
      .insert({
        user_id: user.id,
        token_hash: hashToken(rawTrustedDeviceToken),
        device_name: deviceName,
        user_agent_summary: summarizeUserAgent(req.headers["user-agent"] || ""),
        expires_at: expiresAt,
        last_used_at: new Date().toISOString()
      })
      .select("id, device_name, user_agent_summary, created_at, last_used_at, expires_at")
      .maybeSingle();
    trustedDevice = data;
    logAuth("trusted_device.created", { requestId, userId: user.id, trustedDeviceId: data?.id || null });
  }

  const assuranceToken = randomBytes(32).toString("base64url");
  const assuranceExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { data: assurance } = await supabase
    .from("login_assurances")
    .insert({
      user_id: user.id,
      assurance_token_hash: hashToken(assuranceToken),
      session_reference: req.headers.authorization ? sha256(req.headers.authorization.slice(-64)) : null,
      expires_at: assuranceExpiresAt,
      trusted_device_id: trustedDevice?.id || null
    })
    .select("id, expires_at")
    .maybeSingle();
  const cookies = [serializeCookie(LOGIN_ASSURANCE_COOKIE, assuranceToken, { maxAge: 12 * 60 * 60 })];
  if (trustedDevice && rawTrustedDeviceToken) cookies.push(serializeCookie(TRUSTED_DEVICE_COOKIE, rawTrustedDeviceToken, { maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60 }));
  logAuth("verification.challenge.verified", { requestId, userId: user.id, challengeId: selectedChallenge.id, assuranceId: assurance?.id || null });
  sendJson(res, 200, { verified: true, trustedDevice, assuranceId: assurance?.id || null, expiresAt: assurance?.expires_at || assuranceExpiresAt }, { "Set-Cookie": cookies });
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
  await supabase.from("login_assurances").update({ revoked_at: now }).eq("user_id", user.id).eq("trusted_device_id", id);
  logAuth("trusted_device.revoked", { userId: user.id, trustedDeviceId: id });
  sendJson(res, 200, { message: "Trusted device revoked." }, { "Set-Cookie": [clearCookie(TRUSTED_DEVICE_COOKIE), clearCookie(LOGIN_ASSURANCE_COOKIE)] });
}

export function createSupabaseLoginVerificationMiddleware() {
  return async function supabaseLoginVerificationMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    const matches =
      pathname.startsWith("/api/auth/login-verification") ||
      ["/api/auth/create-login-challenge", "/api/auth/resend-login-challenge", "/api/auth/verify-login-challenge"].includes(pathname) ||
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
      if (pathname === "/api/auth/login-verification/clear" && req.method === "POST") return sendJson(res, 200, { cleared: true }, { "Set-Cookie": clearCookie(LOGIN_ASSURANCE_COOKIE) });
      if (["/api/auth/login-verification/send", "/api/auth/login-verification/create", "/api/auth/login-verification/resend"].includes(pathname) && req.method === "POST") return await handleSend(req, res);
      if (["/api/auth/create-login-challenge", "/api/auth/resend-login-challenge"].includes(pathname) && req.method === "POST") return await handleSend(req, res);
      if (pathname === "/api/auth/login-verification/verify" && req.method === "POST") return await handleVerify(req, res);
      if (pathname === "/api/auth/verify-login-challenge" && req.method === "POST") return await handleVerify(req, res);
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
