/**
 * Auth email delivery for legacy Prisma/JWT registration and password reset.
 * Supabase Auth uses its own email flow — see SUPABASE_AUTH_SETUP.md.
 */

export function isProductionEnv() {
  return process.env.NODE_ENV === "production";
}

/** Development only: print verification/reset links in the server terminal. */
export function shouldLogAuthEmails() {
  return !isProductionEnv() && process.env.PRELUDE_LOG_AUTH_EMAILS !== "0";
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
}

/**
 * Public app base URL for auth links (no trailing slash).
 * Production: set PUBLIC_APP_URL (e.g. https://preludev1.pages.dev).
 */
export function resolvePublicAppUrl(req) {
  const fromEnv = process.env.PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (req?.headers) {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }

  return "http://localhost:5173";
}

export function buildAuthUrl(req, pathWithQuery) {
  const base = resolvePublicAppUrl(req);
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `${base}${path}`;
}

const EMAIL_SUBJECTS = {
  "verify-email": "Verify your Prelude account",
  "password-reset": "Reset your Prelude password"
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAuthEmailHtml({ kind, url }) {
  const safeUrl = escapeHtml(url);
  const isVerify = kind === "verify-email";
  const heading = isVerify ? "Verify your email" : "Reset your password";
  const intro = isVerify
    ? "Thanks for joining Prelude. Confirm your email address to secure your account and prove your identity."
    : "We received a request to reset your Prelude password. Click below to choose a new password.";
  const buttonLabel = isVerify ? "Verify email address" : "Reset password";
  const footer = isVerify
    ? "If you did not create a Prelude account, you can safely ignore this email."
    : "If you did not request a password reset, you can safely ignore this email.";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e2d8;border-radius:16px;padding:32px 28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7f72;">Prelude</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;">${heading}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4a4540;">${intro}</p>
          <p style="margin:0 0 28px;">
            <a href="${safeUrl}" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:999px;">${buttonLabel}</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b645c;">Or copy this link into your browser:</p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;color:#1f4d3a;">${safeUrl}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#8a7f72;">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendViaResend({ kind, to, url }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    console.error(
      `[prelude-auth] Email not sent (${kind}): set RESEND_API_KEY and AUTH_EMAIL_FROM.`
    );
    return { delivered: false, reason: "missing_provider" };
  }

  const subject = EMAIL_SUBJECTS[kind] || "Prelude account notice";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: buildAuthEmailHtml({ kind, url })
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[prelude-auth] Resend error (${response.status}):`, body);
    return { delivered: false, reason: "provider_error" };
  }

  return { delivered: true };
}

/**
 * Send or log a verification / reset link. Uses Resend whenever configured.
 */
export async function deliverAuthEmail({ kind, to, url, req }) {
  if (hasResendConfig()) {
    const result = await sendViaResend({ kind, to, url });
    if (result.delivered) return result;
    if (isProductionEnv()) return result;
  } else if (isProductionEnv()) {
    console.error(
      `[prelude-auth] Email not sent (${kind}): set RESEND_API_KEY and AUTH_EMAIL_FROM in production.`
    );
    return { delivered: false, reason: "missing_provider" };
  }

  if (shouldLogAuthEmails()) {
    console.info(`[prelude-auth:${kind}] To ${to}:\n${url}`);
  }

  return { delivered: false, logged: shouldLogAuthEmails(), devOnly: !hasResendConfig() };
}
