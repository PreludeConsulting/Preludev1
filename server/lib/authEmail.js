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

async function sendViaResend({ kind, to, url }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    console.error(
      `[prelude-auth] Email not sent (${kind}): set RESEND_API_KEY and AUTH_EMAIL_FROM in production.`
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
      html: `<p>Please use the link below to continue:</p><p><a href="${url}">${url}</a></p><p>If you did not request this, you can ignore this email.</p>`
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
 * Send or log a verification / reset link. Never weakens production verification rules.
 */
export async function deliverAuthEmail({ kind, to, url, req }) {
  if (isProductionEnv()) {
    return sendViaResend({ kind, to, url });
  }

  if (shouldLogAuthEmails()) {
    console.info(`[prelude-auth:${kind}] To ${to}:\n${url}`);
  }

  return { delivered: false, logged: shouldLogAuthEmails(), devOnly: true };
}
