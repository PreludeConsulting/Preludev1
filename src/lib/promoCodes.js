import { appPath } from "./appPaths.js";

async function promoRequest(path, body) {
  let response;
  try {
    response = await fetch(appPath(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error("We could not verify the promo code right now. Please try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Promo code validation is not available on this deployment yet. Please try again shortly.");
    }
    const error = new Error(payload.message || "We could not verify the promo code right now. Please try again.");
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function validatePromoCode({ code, email }) {
  return promoRequest("/api/promo/validate", { code, email });
}

export async function redeemPromoCodeAtSignup({ code, email, userId, accessToken }) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(appPath("/api/promo/redeem-at-signup"), {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ code, email, userId })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "Promo code could not be redeemed.");
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function storePendingPromoRedemption(email, code) {
  if (!email || !code) return;
  try {
    sessionStorage.setItem(
      `prelude-pending-promo:${email.toLowerCase()}`,
      JSON.stringify({ code, savedAt: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function readPendingPromoRedemption(email) {
  if (!email) return null;
  try {
    const raw = sessionStorage.getItem(`prelude-pending-promo:${email.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(`prelude-pending-promo:${email.toLowerCase()}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPromoRedemption(email) {
  if (!email) return;
  try {
    sessionStorage.removeItem(`prelude-pending-promo:${email.toLowerCase()}`);
  } catch {
    /* ignore */
  }
}
