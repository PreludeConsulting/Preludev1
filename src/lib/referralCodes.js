import { appPath } from "./appPaths.js";
import { getSupabase } from "./supabase.js";
import {
  REFERRAL_CODE_PATTERN,
  normalizeReferralCodeInput,
  publicReferralError
} from "../../shared/referralConstants.js";

async function getBearerToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function referralRequest(path, { method = "GET", body = null, auth = false } = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (auth) {
    const token = await getBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(appPath(path), {
      method,
      headers,
      credentials: "include",
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error(publicReferralError("server_error"));
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || publicReferralError(payload.error) || publicReferralError("server_error"));
    error.code = payload.error;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function fetchMyReferralCode() {
  return referralRequest("/api/referral/code", { method: "GET", auth: true });
}

export async function validateReferralCode({ code, role, email }) {
  return referralRequest("/api/referral/validate", {
    method: "POST",
    auth: true,
    body: {
      code: normalizeReferralCodeInput(code),
      role,
      email: email || undefined
    }
  });
}

export async function associateReferralCode({ code, role, email, userId, accessToken }) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else {
    const token = await getBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(appPath("/api/referral/associate"), {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        code: normalizeReferralCodeInput(code),
        role,
        email: email || undefined,
        userId: userId || undefined
      })
    });
  } catch {
    throw new Error(publicReferralError("server_error"));
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || publicReferralError(payload.error) || publicReferralError("server_error"));
    error.code = payload.error;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function listReferralRewards() {
  return referralRequest("/api/referral/rewards", { method: "GET", auth: true });
}

export async function claimReferralReward(rewardId) {
  return referralRequest("/api/referral/claim", {
    method: "POST",
    auth: true,
    body: { rewardId }
  });
}

export function isValidReferralCodeFormatClient(code) {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCodeInput(code));
}

export { normalizeReferralCodeInput, publicReferralError };
