import { getSupabase } from "./supabase.js";

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

async function verificationApi(path, options = {}) {
  const token = await getAccessToken();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function checkLoginVerification() {
  return verificationApi("/api/auth/login-verification/check");
}

export async function sendLoginVerificationCode() {
  return verificationApi("/api/auth/login-verification/send", { method: "POST" });
}

export async function verifyLoginCode({ code, trustDevice = false, deviceName = "" }) {
  return verificationApi("/api/auth/login-verification/verify", {
    method: "POST",
    body: JSON.stringify({ code, trustDevice, deviceName })
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
