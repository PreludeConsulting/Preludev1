import { getSupabase } from "./supabase.js";
import { getSupabaseProjectRef } from "./supabaseConfig.js";

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("You must be signed in to continue.");
  }
  return session.access_token;
}

function looksLikeHtml(text = "") {
  const sample = String(text || "").trim().slice(0, 200).toLowerCase();
  return sample.startsWith("<!doctype") || sample.startsWith("<html") || sample.includes("<head");
}

function logVerificationDebug(details = {}) {
  if (!import.meta.env.DEV) return;
  console.error("[prelude-auth] login_verification", {
    ...details,
    projectRef: getSupabaseProjectRef()
  });
}

async function verificationApi(path, options = {}) {
  const token = await getAccessToken();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(path, {
      credentials: "include",
      ...options,
      headers
    });
  } catch (error) {
    logVerificationDebug({
      path,
      errorName: error?.name || null,
      message: error?.message || null,
      network: true
    });
    throw error;
  }

  const rawText = await response.text();
  let payload = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = {};
    }
  }

  if (looksLikeHtml(rawText) || (response.ok && rawText && typeof payload !== "object")) {
    const error = new Error(
      "Prelude could not reach the verification API. The server returned a web page instead of JSON."
    );
    error.status = response.status || 502;
    error.payload = { error: "html_response", message: error.message };
    logVerificationDebug({
      path,
      status: response.status,
      errorCode: "html_response",
      message: error.message,
      contentType: response.headers.get("content-type")
    });
    throw error;
  }

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed.");
    error.status = response.status;
    error.payload = payload && typeof payload === "object" ? payload : { error: "request_failed" };
    logVerificationDebug({
      path,
      status: response.status,
      errorName: error.name,
      errorCode: payload?.error || null,
      message: error.message
    });
    throw error;
  }

  return payload && typeof payload === "object" ? payload : {};
}

export async function checkLoginVerification() {
  return verificationApi("/api/auth/login-verification/check");
}

export async function sendLoginVerificationCode() {
  return verificationApi("/api/auth/create-login-challenge", { method: "POST" });
}

export async function verifyLoginCode({ challengeId = "", code, trustDevice = false, deviceName = "" }) {
  const normalizedCode = String(code || "").replace(/\D/g, "");
  return verificationApi("/api/auth/verify-login-challenge", {
    method: "POST",
    body: JSON.stringify({
      challengeId: challengeId || undefined,
      code: normalizedCode,
      trustDevice,
      deviceName
    })
  });
}

export async function listTrustedDevices() {
  return verificationApi("/api/auth/trusted-devices");
}

export async function revokeTrustedDevice(id) {
  return verificationApi(`/api/auth/trusted-devices/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function revokeOtherTrustedDevices() {
  return verificationApi("/api/auth/trusted-devices/others", { method: "DELETE" });
}

export async function clearLoginAssurance() {
  return fetch("/api/auth/login-verification/clear", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" }
  }).catch(() => null);
}
