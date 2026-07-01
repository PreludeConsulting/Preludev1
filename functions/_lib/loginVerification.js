const TRUSTED_DEVICE_COOKIE = "prelude_trusted_device";
const LOGIN_ASSURANCE_COOKIE = "prelude_login_assurance";
const CODE_TTL_MINUTES = 10;
const SEND_COOLDOWN_SECONDS = 30;
const SEND_LIMIT_PER_HOUR = 5;
const MAX_FAILED_ATTEMPTS = 5;
const TRUSTED_DEVICE_DAYS = 30;
const LOGIN_VERIFICATION_STORAGE_ERROR = "login_verification_storage_missing";
const LOGIN_VERIFICATION_STORAGE_MESSAGE =
  "Prelude login verification storage is not configured yet. Run supabase/migrations/20260629000000_login_verification_trusted_devices.sql in Supabase, then retry sign-in.";

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders
  });
}

function getEnv(context, name) {
  return context.env?.[name] || "";
}

function getSupabaseUrl(context) {
  return getEnv(context, "SUPABASE_URL") || getEnv(context, "VITE_SUPABASE_URL");
}

function getServiceRoleKey(context) {
  return getEnv(context, "SUPABASE_SERVICE_ROLE_KEY");
}

function getSecret(context) {
  return getEnv(context, "LOGIN_CODE_SECRET") || getServiceRoleKey(context) || "dev-only-login-code-secret";
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (options.secure !== false) parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function clearCookie(name) {
  return serializeCookie(name, "", { maxAge: 0 });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let value = "";
  for (const byte of data) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function makeCode() {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return String(data[0] % 1_000_000).padStart(6, "0");
}

async function hashCode(context, userId, code) {
  return sha256(`${userId}:${code}:${getSecret(context)}`);
}

async function hashToken(context, rawToken) {
  return sha256(`${rawToken}:${getSecret(context)}`);
}

function requestId() {
  return randomToken(9);
}

function logAuth(event, details = {}) {
  console.log(JSON.stringify({ source: "prelude-auth", event, timestamp: new Date().toISOString(), ...details }));
}

function isLoginVerificationStorageError(error) {
  const text = `${error?.message || ""} ${error?.body?.message || ""} ${error?.body?.hint || ""} ${error?.body?.code || ""}`.toLowerCase();
  if (!text) return false;
  return (
    text.includes("login_verification_challenges") ||
    text.includes("trusted_devices") ||
    text.includes("login_assurances") ||
    text.includes("schema cache")
  );
}

function loginVerificationStorageResponse(error) {
  logAuth("verification.storage.missing", {
    reason: error?.body?.code || error?.message || "unknown"
  });
  return json(
    {
      error: LOGIN_VERIFICATION_STORAGE_ERROR,
      message: LOGIN_VERIFICATION_STORAGE_MESSAGE
    },
    503
  );
}

function recipientDomain(email = "") {
  return email.includes("@") ? email.split("@").pop().toLowerCase() : "unknown";
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

async function supabaseFetch(context, path, options = {}) {
  const supabaseUrl = getSupabaseUrl(context);
  const key = getServiceRoleKey(context);
  if (!supabaseUrl || !key) throw Object.assign(new Error("Supabase server credentials are not configured."), { status: 503 });
  const url = `${supabaseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw Object.assign(new Error(body?.message || body?.hint || "Supabase request failed."), { status: response.status, body });
  }
  return body;
}

async function requireUser(context) {
  const supabaseUrl = getSupabaseUrl(context);
  const key = getServiceRoleKey(context);
  if (!supabaseUrl || !key) throw Object.assign(new Error("Supabase server credentials are not configured."), { status: 503 });
  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) throw Object.assign(new Error("Authentication required."), { status: 401 });
  return user;
}

async function findTrustedDevice(context, userId) {
  const cookies = parseCookies(context.request.headers.get("Cookie") || "");
  const raw = cookies[TRUSTED_DEVICE_COOKIE];
  if (!raw) return null;
  const tokenHash = await hashToken(context, raw);
  const rows = await supabaseFetch(
    context,
    `/rest/v1/trusted_devices?select=id,device_name,user_agent_summary,created_at,last_used_at,expires_at,revoked_at&user_id=eq.${userId}&token_hash=eq.${tokenHash}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`
  );
  const device = rows?.[0] || null;
  if (!device) return null;
  await supabaseFetch(context, `/rest/v1/trusted_devices?id=eq.${device.id}`, {
    method: "PATCH",
    body: JSON.stringify({ last_used_at: new Date().toISOString() })
  });
  logAuth("trusted_device.accepted", { userId, trustedDeviceId: device.id });
  return device;
}

async function findAssurance(context, userId) {
  const cookies = parseCookies(context.request.headers.get("Cookie") || "");
  const raw = cookies[LOGIN_ASSURANCE_COOKIE];
  if (!raw) return null;
  const tokenHash = await hashToken(context, raw);
  const rows = await supabaseFetch(
    context,
    `/rest/v1/login_assurances?select=id,expires_at,trusted_device_id&user_id=eq.${userId}&assurance_token_hash=eq.${tokenHash}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`
  );
  return rows?.[0] || null;
}

async function sendEmail(context, { to, code, challengeId, requestId: rid }) {
  const apiKey = getEnv(context, "RESEND_API_KEY");
  const from = getEnv(context, "AUTH_EMAIL_FROM") || "Prelude <no-reply@preludeconsultingllc.com>";
  logAuth("verification.email.requested", { requestId: rid, challengeId, recipientDomain: recipientDomain(to) });
  if (!apiKey) {
    logAuth("verification.email.failed", { requestId: rid, challengeId, reason: "missing_provider" });
    return { delivered: false, reason: "missing_provider" };
  }

  const device = summarizeUserAgent(context.request.headers.get("User-Agent") || "");
  const issuedAt = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const logoUrl = "https://preludeconsultingllc.com/prelude-email-logo.png";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4efff;font-family:Barlow,Arial,Helvetica,sans-serif;color:#171423;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efff;padding:32px 16px;font-family:Barlow,Arial,Helvetica,sans-serif;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e9ddff;border-radius:16px;padding:32px;box-shadow:0 18px 48px rgba(80,35,180,.12);font-family:Barlow,Arial,Helvetica,sans-serif;"><tr><td><img src="${logoUrl}" width="74" alt="Prelude" style="display:block;width:74px;height:auto;margin:0 0 20px;"><h1 style="margin:0 0 12px;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:600;letter-spacing:0;color:#21103f;">Your Prelude verification code</h1><p style="margin:0 0 18px;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;font-weight:400;color:#4e4564;">Use this code to finish signing in:</p><p style="margin:0 0 20px;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:40px;line-height:1;letter-spacing:0;font-weight:600;color:#6d28d9;">${code}</p><p style="margin:0 0 12px;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;font-weight:400;color:#4e4564;">This code expires in 10 minutes.</p><p style="margin:0 0 12px;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;font-weight:400;color:#716780;">Requested around ${issuedAt} from ${device}.</p><p style="margin:0 0 20px;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;font-weight:400;color:#716780;">If you did not attempt to sign in, you can safely ignore this email and consider changing your password.</p><p style="margin:0;font-family:Barlow,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;font-weight:400;color:#8a8098;">Prelude Consulting LLC</p></td></tr></table></td></tr></table></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Your Prelude verification code", html })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logAuth("verification.email.failed", { requestId: rid, challengeId, resendStatus: response.status, reason: body?.name || body?.message || "provider_error" });
    return { delivered: false, reason: "provider_error", status: response.status };
  }
  logAuth("verification.email.accepted", { requestId: rid, challengeId, resendStatus: response.status, resendMessageId: body?.id || null });
  return { delivered: true, messageId: body?.id || null };
}

export async function handleLoginVerification(context, action) {
  try {
    if (action === "check-trusted-device" || action === "check") {
      const user = await requireUser(context);
      const trustedDevice = await findTrustedDevice(context, user.id);
      const assurance = trustedDevice ? null : await findAssurance(context, user.id);
      return json({ verified: Boolean(trustedDevice || assurance), trustedDevice: Boolean(trustedDevice), device: trustedDevice, assuranceId: assurance?.id || null });
    }

    if (action === "clear") {
      return json({ cleared: true }, 200, { "Set-Cookie": clearCookie(LOGIN_ASSURANCE_COOKIE) });
    }

    if (action === "create-login-challenge" || action === "resend-login-challenge" || action === "send" || action === "create" || action === "resend") {
      const rid = requestId();
      const user = await requireUser(context);
      logAuth("verification.challenge.create.started", { requestId: rid, userId: user.id });
      if (!user.email || !user.email_confirmed_at) return json({ error: "email_unconfirmed", message: "Confirm your email before completing login verification." }, 403);
      const sinceCooldown = new Date(Date.now() - SEND_COOLDOWN_SECONDS * 1000).toISOString();
      const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await supabaseFetch(context, `/rest/v1/login_verification_challenges?select=id&user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(sinceCooldown)}&limit=1`);
      if (recent?.length) return json({ error: "cooldown", message: "Please wait before requesting another code.", retryAfter: SEND_COOLDOWN_SECONDS }, 429);
      const hourly = await supabaseFetch(context, `/rest/v1/login_verification_challenges?select=id&user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(sinceHour)}`);
      if ((hourly || []).length >= SEND_LIMIT_PER_HOUR) return json({ error: "rate_limited", message: "Too many verification codes requested. Try again later." }, 429);
      await supabaseFetch(context, `/rest/v1/login_verification_challenges?user_id=eq.${user.id}&used_at=is.null`, { method: "PATCH", body: JSON.stringify({ used_at: new Date().toISOString() }) });
      const code = makeCode();
      const rows = await supabaseFetch(context, "/rest/v1/login_verification_challenges?select=id,expires_at", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          code_hash: await hashCode(context, user.id, code),
          expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
          requested_ip_hash: await sha256(`${context.request.headers.get("CF-Connecting-IP") || "unknown"}:${getSecret(context)}`),
          user_agent_summary: summarizeUserAgent(context.request.headers.get("User-Agent") || ""),
          delivery_status: "pending"
        })
      });
      const challenge = rows?.[0];
      logAuth("verification.challenge.created", { requestId: rid, userId: user.id, challengeId: challenge.id });
      const delivery = await sendEmail(context, { to: user.email, code, challengeId: challenge.id, requestId: rid });
      await supabaseFetch(context, `/rest/v1/login_verification_challenges?id=eq.${challenge.id}`, {
        method: "PATCH",
        body: JSON.stringify({ delivery_status: delivery.delivered ? "accepted" : delivery.reason || "failed", resend_message_id: delivery.messageId || null })
      });
      if (!delivery.delivered) return json({ error: "email_delivery_failed", message: "Verification email could not be sent. Check Resend configuration.", requestId: rid }, 503);
      return json({ challengeId: challenge.id, expiresAt: challenge.expires_at, resendMessageId: delivery.messageId || null, emailSent: true, requestId: rid, message: "Verification code sent." });
    }

    if (action === "verify-login-challenge" || action === "verify") {
      const rid = requestId();
      const user = await requireUser(context);
      const payload = await context.request.json().catch(() => ({}));
      const code = String(payload.code || "").replace(/\D/g, "");
      if (code.length !== 6) return json({ error: "invalid_code", message: "Enter the six-digit code." }, 400);
      const challengeQuery = payload.challengeId
        ? `/rest/v1/login_verification_challenges?select=id,code_hash,expires_at,used_at,failed_attempts,locked_at&id=eq.${payload.challengeId}&user_id=eq.${user.id}&limit=1`
        : `/rest/v1/login_verification_challenges?select=id,code_hash,expires_at,used_at,failed_attempts,locked_at&user_id=eq.${user.id}&used_at=is.null&locked_at=is.null&order=created_at.desc&limit=1`;
      const selected = (await supabaseFetch(context, challengeQuery))?.[0];
      if (!selected) return json({ error: "missing_challenge", message: "Request a new verification code." }, 400);
      if (selected.used_at) return json({ error: "used_code", message: "This code has already been used." }, 400);
      if (new Date(selected.expires_at) <= new Date()) return json({ error: "expired_code", message: "This code expired. Request a new one." }, 400);
      if (selected.locked_at || selected.failed_attempts >= MAX_FAILED_ATTEMPTS) return json({ error: "locked_challenge", message: "Too many incorrect attempts. Request a new code." }, 423);
      if (selected.code_hash !== (await hashCode(context, user.id, code))) {
        const failedAttempts = selected.failed_attempts + 1;
        await supabaseFetch(context, `/rest/v1/login_verification_challenges?id=eq.${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({ failed_attempts: failedAttempts, locked_at: failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date().toISOString() : null })
        });
        logAuth("verification.challenge.rejected", { requestId: rid, userId: user.id, challengeId: selected.id, failedAttempts });
        return json({ error: "incorrect_code", message: "That code is not correct." }, 401);
      }
      await supabaseFetch(context, `/rest/v1/login_verification_challenges?id=eq.${selected.id}`, { method: "PATCH", body: JSON.stringify({ used_at: new Date().toISOString() }) });
      let trustedDevice = null;
      let trustedDeviceRaw = null;
      if (payload.trustDevice) {
        trustedDeviceRaw = randomToken(32);
        const rows = await supabaseFetch(context, "/rest/v1/trusted_devices?select=id,device_name,user_agent_summary,created_at,last_used_at,expires_at", {
          method: "POST",
          body: JSON.stringify({
            user_id: user.id,
            token_hash: await hashToken(context, trustedDeviceRaw),
            device_name: payload.deviceName || summarizeUserAgent(context.request.headers.get("User-Agent") || ""),
            user_agent_summary: summarizeUserAgent(context.request.headers.get("User-Agent") || ""),
            last_used_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000).toISOString()
          })
        });
        trustedDevice = rows?.[0] || null;
        logAuth("trusted_device.created", { requestId: rid, userId: user.id, trustedDeviceId: trustedDevice?.id || null });
      }
      const assuranceRaw = randomToken(32);
      const assuranceRows = await supabaseFetch(context, "/rest/v1/login_assurances?select=id,expires_at", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          assurance_token_hash: await hashToken(context, assuranceRaw),
          session_reference: await sha256((context.request.headers.get("Authorization") || "").slice(-64)),
          trusted_device_id: trustedDevice?.id || null,
          expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        })
      });
      const headers = new Headers();
      headers.append("Set-Cookie", serializeCookie(LOGIN_ASSURANCE_COOKIE, assuranceRaw, { maxAge: 12 * 60 * 60 }));
      if (trustedDeviceRaw) headers.append("Set-Cookie", serializeCookie(TRUSTED_DEVICE_COOKIE, trustedDeviceRaw, { maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60 }));
      logAuth("verification.challenge.verified", { requestId: rid, userId: user.id, challengeId: selected.id, assuranceId: assuranceRows?.[0]?.id || null });
      return json({ verified: true, trustedDevice, assuranceId: assuranceRows?.[0]?.id || null }, 200, headers);
    }

    return json({ error: "not_found" }, 404);
  } catch (error) {
    if (isLoginVerificationStorageError(error)) return loginVerificationStorageResponse(error);
    const status = error.status || 500;
    if (status >= 500) console.error("[prelude-auth]", error.message);
    return json({ error: status >= 500 ? "server_error" : "request_failed", message: error.message || "Request failed." }, status);
  }
}

export async function handleTrustedDevices(context, id = "") {
  try {
    const user = await requireUser(context);
    if (context.request.method === "GET") {
      const devices = await supabaseFetch(context, `/rest/v1/trusted_devices?select=id,device_name,user_agent_summary,created_at,last_used_at,expires_at,revoked_at&user_id=eq.${user.id}&order=created_at.desc`);
      return json({ devices: devices || [] });
    }
    if (context.request.method === "DELETE") {
      const now = new Date().toISOString();
      if (id === "others") {
        const current = await findTrustedDevice(context, user.id);
        const suffix = current?.id ? `&id=neq.${current.id}` : "";
        await supabaseFetch(context, `/rest/v1/trusted_devices?user_id=eq.${user.id}&revoked_at=is.null${suffix}`, { method: "PATCH", body: JSON.stringify({ revoked_at: now }) });
        return json({ message: "Other trusted devices revoked." });
      }
      await supabaseFetch(context, `/rest/v1/trusted_devices?id=eq.${id}&user_id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ revoked_at: now }) });
      await supabaseFetch(context, `/rest/v1/login_assurances?trusted_device_id=eq.${id}&user_id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify({ revoked_at: now }) });
      const headers = new Headers();
      headers.append("Set-Cookie", clearCookie(TRUSTED_DEVICE_COOKIE));
      headers.append("Set-Cookie", clearCookie(LOGIN_ASSURANCE_COOKIE));
      logAuth("trusted_device.revoked", { userId: user.id, trustedDeviceId: id });
      return json({ message: "Trusted device revoked." }, 200, headers);
    }
    return json({ error: "not_found" }, 404);
  } catch (error) {
    if (isLoginVerificationStorageError(error)) return loginVerificationStorageResponse(error);
    const status = error.status || 500;
    return json({ error: status >= 500 ? "server_error" : "request_failed", message: error.message || "Request failed." }, status);
  }
}
