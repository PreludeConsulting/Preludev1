import { resolvePublicAppUrl } from "./authEmail.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return null;
  }
}

export function buildPromoWelcomeEmailHtml({
  email,
  publicCode,
  campaignName,
  permanentAccess,
  promotionEndsAt,
  dashboardUrl,
  supportEmail = "support@preludeconsultingllc.com"
}) {
  const safeEmail = escapeHtml(email);
  const safeCode = escapeHtml(publicCode);
  const safeCampaign = escapeHtml(campaignName || "Complimentary Basic Plan");
  const safeDashboard = escapeHtml(dashboardUrl);
  const safeSupport = escapeHtml(supportEmail);

  const accessLine = permanentAccess
    ? "Your complimentary Basic Plan does not expire while your account remains active."
    : promotionEndsAt
      ? `Your promotional access is active through ${escapeHtml(formatDate(promotionEndsAt) || "the end of your promotion period")}.`
      : "Your promotional access period is shown in your Prelude account settings.";

  const billingLine = permanentAccess
    ? "You will not be charged automatically unless you choose to upgrade to a paid plan."
    : "When your promotion ends, you may need to add a payment method to keep full access.";

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f4ef;font-family:Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:16px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#7a5c2e;">Prelude</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">Your account is ready</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Welcome to Prelude. Your account for <strong>${safeEmail}</strong> was created successfully.</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Your promo code <strong>${safeCode}</strong> was accepted and your complimentary <strong>Basic Plan</strong> is now active under the <strong>${safeCampaign}</strong> promotion.</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${accessLine}</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${billingLine} No payment method was required during registration.</p>
          <p style="margin:0 0 24px;">
            <a href="${safeDashboard}" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700;">Continue to Dashboard</a>
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#666;">Questions? Contact us at <a href="mailto:${safeSupport}" style="color:#1f4d3a;">${safeSupport}</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function deliverPromoWelcomeEmail({
  to,
  publicCode,
  campaignName,
  permanentAccess,
  promotionEndsAt,
  req,
  env = process.env
}) {
  const runtimeEnv = env || process.env;
  const dashboardUrl = `${resolvePublicAppUrl(req, runtimeEnv)}/dashboard`;
  const html = buildPromoWelcomeEmailHtml({
    email: to,
    publicCode,
    campaignName,
    permanentAccess,
    promotionEndsAt,
    dashboardUrl,
    supportEmail: runtimeEnv.SUPPORT_EMAIL || "support@preludeconsultingllc.com"
  });

  if (!runtimeEnv.RESEND_API_KEY?.trim() || !runtimeEnv.AUTH_EMAIL_FROM?.trim()) {
    if (runtimeEnv.NODE_ENV !== "production") {
      console.info("[prelude-promo] welcome_email_skipped", { to, publicCode });
    }
    return { delivered: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: runtimeEnv.AUTH_EMAIL_FROM,
      to: [to],
      subject: "Your complimentary Prelude Basic Plan is active",
      html
    })
  });

  if (!response.ok) {
    console.error("[prelude-promo] welcome_email_failed", { status: response.status });
    return { delivered: false };
  }

  return { delivered: true };
}
