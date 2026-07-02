const TECHNICAL_PATTERN =
  /jwt|pgrst|postgres|sql|unexpected token|internal server|500|401|403|invalid_grant|oauth/i;

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function friendlyAuthError(message = "", context = "signin") {
  const raw = String(message || "").trim();
  if (!raw) {
    return context === "signin"
      ? "We couldn't sign you in. Check your email and password."
      : "Something went wrong. Please try again.";
  }

  const lower = raw.toLowerCase();

  if (/invalid login credentials|invalid email or password|invalid credentials/i.test(raw)) {
    return "That email or password doesn't look right. Try again or reset your password.";
  }
  if (/email not confirmed|confirm your email|email address is not confirmed/i.test(raw)) {
    return "Confirm your email before signing in. Check your inbox for the verification link.";
  }
  if (/already registered|already exists|user already registered/i.test(raw)) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (/network|fetch failed|failed to fetch|networkerror/i.test(lower)) {
    return "Connection problem. Check your internet and try again.";
  }
  if (/too many requests|rate limit|email rate limit/i.test(lower)) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (/same password|different from your current password/i.test(lower)) {
    return "Choose a new password that is different from your current password.";
  }
  if (/invalid or expired|otp_expired|secure link is invalid/i.test(lower)) {
    return "This reset link is invalid or has expired. Request a new reset email.";
  }
  if (/captcha|turnstile|security check/i.test(lower)) {
    return "Complete the security check and try again.";
  }
  if (/password should be at least|password must be at least|passwords don't match/i.test(raw)) {
    return raw;
  }
  if (/choose student, mentor, or parent|accept prelude/i.test(raw)) {
    return raw;
  }
  if (TECHNICAL_PATTERN.test(raw)) {
    return context === "signin"
      ? "We couldn't sign you in right now. Try again in a moment."
      : "We couldn't complete that request right now. Try again in a moment.";
  }
  if (raw.length > 140) {
    return "Something went wrong. Please try again.";
  }

  return raw;
}

export function getPasswordHints(password, supabaseAuth) {
  if (supabaseAuth) {
    return [{ label: "At least 6 characters", met: password.length >= 6 }];
  }

  return [
    { label: "At least 12 characters", met: password.length >= 12 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One symbol", met: /[^A-Za-z0-9]/.test(password) }
  ];
}
