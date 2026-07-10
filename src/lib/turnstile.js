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

export function getTurnstileStatusMessage(status) {
  if (status === "loading") return "Loading security check…";
  if (status === "error") return "The security check could not load. Try again.";
  if (status === "expired") return "The security check expired. Complete it again.";
  if (status === "ready") return "Security check ready.";
  return "Complete the security check to continue.";
}

export function canSubmitWithTurnstile({ required = isTurnstileRequired(), token = "", status = "idle" } = {}) {
  return !required || (Boolean(token) && status === "ready");
}
