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

function hasResendConfig(env = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.AUTH_EMAIL_FROM?.trim());
}

/**
 * Public app base URL for auth links (no trailing slash).
 * Production: set PUBLIC_APP_URL (e.g. https://preludev1.pages.dev).
 */
export function resolvePublicAppUrl(req, env = process.env) {
  const fromEnv = env.PUBLIC_APP_URL?.trim() || env.VITE_PUBLIC_APP_URL?.trim();
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

export function buildAuthUrl(req, pathWithQuery, env = process.env) {
  const base = resolvePublicAppUrl(req, env);
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `${base}${path}`;
}

const EMAIL_SUBJECTS = {
  "verify-email": "Verify your Prelude account",
  "password-reset": "Reset your Prelude password",
  "account-deleted": "Your Prelude account has been deleted",
  "parent-invite": "You're invited to follow your student's Prelude journey"
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

function buildAccountDeletedHtml({ firstName, email }) {
  const safeName = escapeHtml(firstName || "there");
  const safeEmail = escapeHtml(email);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e2d8;border-radius:16px;padding:32px 28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7f72;">Prelude</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;">Account deleted</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4a4540;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4a4540;">This confirms that your Prelude account (<strong>${safeEmail}</strong>) has been permanently deleted from our database.</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4a4540;">You will no longer be able to sign in with this account. If you return to Prelude, you will need to create a new account.</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#8a7f72;">If you did not request this deletion, contact us immediately at hello@preludeconsulting.com.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendHtmlViaResend({ subject, to, html, env = process.env }) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    console.error("[prelude-auth] Email not sent: set RESEND_API_KEY and AUTH_EMAIL_FROM.");
    return { delivered: false, reason: "missing_provider" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[prelude-auth] Resend error (${response.status}):`, body);
    return { delivered: false, reason: "provider_error" };
  }

  return { delivered: true };
}

async function sendViaResend({ kind, to, url, env = process.env }) {
  const subject = EMAIL_SUBJECTS[kind] || "Prelude account notice";
  return sendHtmlViaResend({ subject, to, html: buildAuthEmailHtml({ kind, url }), env });
}

/**
 * Send or log a verification / reset link. Uses Resend whenever configured.
 */
export async function deliverAuthEmail({ kind, to, url, req, env = process.env }) {
  if (hasResendConfig(env)) {
    const result = await sendViaResend({ kind, to, url, env });
    if (result.delivered) return result;
    if (isProductionEnv()) return result;
  } else if (isProductionEnv()) {
    console.error(
      "[prelude-auth] Email not sent: set RESEND_API_KEY and AUTH_EMAIL_FROM in production."
    );
    return { delivered: false, reason: "missing_provider" };
  }

  if (shouldLogAuthEmails()) {
    console.info(`[prelude-auth:${kind}] To ${to}:\n${url}`);
  }

  return { delivered: false, logged: shouldLogAuthEmails(), devOnly: !hasResendConfig(env) };
}

/** Confirmation email after permanent account deletion. */
export async function deliverAccountDeletedEmail({ to, firstName, req }) {
  const subject = EMAIL_SUBJECTS["account-deleted"];
  const html = buildAccountDeletedHtml({ firstName, email: to });

  if (hasResendConfig()) {
    const result = await sendHtmlViaResend({ subject, to, html });
    if (result.delivered) return result;
    if (isProductionEnv()) return result;
  } else if (isProductionEnv()) {
    console.error(
      "[prelude-auth] Deletion email not sent: set RESEND_API_KEY and AUTH_EMAIL_FROM in production."
    );
    return { delivered: false, reason: "missing_provider" };
  }

  if (shouldLogAuthEmails()) {
    console.info(`[prelude-auth:account-deleted] To ${to}: account permanently deleted.`);
  }

  return { delivered: false, logged: shouldLogAuthEmails(), devOnly: !hasResendConfig() };
}

function buildParentInviteHtml({ studentName, url }) {
  const safeName = escapeHtml(studentName || "your student");
  const safeUrl = escapeHtml(url);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e2d8;border-radius:16px;padding:32px 28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7f72;">Prelude</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;">Follow ${safeName}'s college journey</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4a4540;">
            ${safeName} invited you to Prelude as a parent or guardian. Create your account to see a summarized view of their progress, calendar, and mentor updates.
          </p>
          <p style="margin:0 0 28px;">
            <a href="${safeUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:15px;font-weight:600;">Accept invitation</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#8a7f72;">If you were not expecting this, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Email sent when a student invites a parent/guardian. */
export async function deliverParentInviteEmail({ to, studentName, url, req }) {
  const subject = EMAIL_SUBJECTS["parent-invite"];
  const html = buildParentInviteHtml({ studentName, url });

  if (hasResendConfig()) {
    const result = await sendHtmlViaResend({ subject, to, html });
    if (result.delivered) return result;
    if (isProductionEnv()) return result;
  } else if (isProductionEnv()) {
    console.error(
      "[prelude-auth] Parent invite not sent: set RESEND_API_KEY and AUTH_EMAIL_FROM in production."
    );
    return { delivered: false, reason: "missing_provider" };
  }

  if (shouldLogAuthEmails()) {
    console.info(`[prelude-auth:parent-invite] To ${to} for student ${studentName}:\n${url}`);
  }

  return { delivered: false, logged: shouldLogAuthEmails(), devOnly: !hasResendConfig() };
}
