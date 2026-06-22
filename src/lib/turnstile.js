export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

export function isTurnstileRequired() {
  return Boolean(TURNSTILE_SITE_KEY);
}

export function requireTurnstileToken(token, required = isTurnstileRequired()) {
  if (!required) return;
  if (!token) {
    throw new Error("Please complete the security check and try again.");
  }
}

export function captchaOptions(captchaToken) {
  return captchaToken ? { captchaToken } : {};
}
