import { z } from "zod";
import { sendContactEmail } from "./contactBookings.js";

export const BUG_CATEGORIES = [
  "Login / signup issue",
  "Dashboard issue",
  "Mentor matching issue",
  "Messaging issue",
  "Meetings / calendar issue",
  "Payment / subscription issue",
  "Profile / settings issue",
  "Other"
];

export const bugReportSchema = z.object({
  category: z.enum(BUG_CATEGORIES),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10000),
  pageUrl: z.string().trim().max(2048).optional().default(""),
  userAgent: z.string().trim().max(1000).optional().default(""),
  environment: z.string().trim().max(120).optional().default(""),
  account: z.object({
    name: z.string().trim().max(160).optional().default(""),
    email: z.string().trim().email().max(255).or(z.literal("")).optional().default(""),
    role: z.string().trim().max(80).optional().default(""),
    userId: z.string().trim().max(160).optional().default("")
  }).optional()
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayValue(value) {
  return escapeHtml(value || "Not available");
}

function detailCell(label, value) {
  return `<td class="detail-cell" width="50%" valign="top" style="width:50%;padding:0 8px 14px 0;vertical-align:top;"><div style="margin:0 0 4px;color:#706a85;font-size:11px;font-weight:700;letter-spacing:.06em;line-height:1.35;text-transform:uppercase;">${escapeHtml(label)}</div><div style="color:#17113f;font-size:14px;font-weight:600;line-height:1.45;overflow-wrap:anywhere;word-break:break-word;">${displayValue(value)}</div></td>`;
}

function informationRow(label, value) {
  return `<tr><td width="118" valign="top" style="width:118px;padding:7px 14px 7px 0;color:#706a85;font-size:13px;font-weight:600;line-height:1.4;vertical-align:top;">${escapeHtml(label)}</td><td valign="top" style="padding:7px 0;color:#17113f;font-size:14px;line-height:1.4;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;">${displayValue(value)}</td></tr>`;
}

function mergeAccount(reportAccount, verifiedAccount) {
  const submitted = reportAccount || {};
  if (!verifiedAccount) return submitted;
  return {
    name: verifiedAccount.name || submitted.name || "",
    email: verifiedAccount.email || submitted.email || "",
    role: verifiedAccount.role || submitted.role || "",
    userId: verifiedAccount.userId || submitted.userId || ""
  };
}

export async function sendBugReport({ env = process.env, payload, verifiedAccount }) {
  const report = bugReportSchema.parse(payload);
  const account = mergeAccount(report.account, verifiedAccount);
  const timestamp = new Date().toISOString();
  const supportEmail = (env.BUG_REPORT_EMAIL || env.CONTACT_SUPPORT_EMAIL || "preludesupport@preludeconsultingllc.com").trim();
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>@media only screen and (max-width:600px){.email-shell{padding:16px 10px!important}.card-content{padding:26px 20px!important}.detail-cell{display:block!important;width:100%!important;padding-right:0!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#17113f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f4f6;">
    <tr>
      <td class="email-shell" align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;background:#ffffff;border:1px solid #e2e4e9;border-radius:14px;box-shadow:0 8px 24px rgba(23,17,63,.07);overflow:hidden;">
          <tr><td height="5" style="height:5px;background:#7c3aed;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td class="card-content" style="padding:34px 38px 38px;">
              <div style="margin:0 0 10px;color:#7c3aed;font-size:11px;font-weight:700;letter-spacing:.13em;line-height:1.3;text-transform:uppercase;">Prelude Bug Report</div>
              <h1 style="margin:0;color:#17113f;font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.25;">${escapeHtml(report.title)}</h1>
              <p style="margin:8px 0 0;color:#706a85;font-size:13px;line-height:1.5;">New issue submitted from preludeconsultingllc.com</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:28px;border-bottom:1px solid #e8e9ed;">
                <tr>${detailCell("Category", report.category)}${detailCell("Page URL", report.pageUrl)}</tr>
                <tr>${detailCell("Environment", report.environment)}${detailCell("Timestamp", timestamp)}</tr>
              </table>

              <h2 style="margin:26px 0 8px;color:#17113f;font-size:15px;font-weight:700;line-height:1.4;">User Information</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
                ${informationRow("User name", account.name)}
                ${informationRow("User email", account.email)}
                ${informationRow("User role", account.role)}
                ${informationRow("User ID", account.userId)}
              </table>

              <h2 style="margin:26px 0 8px;padding-top:24px;border-top:1px solid #e8e9ed;color:#17113f;font-size:15px;font-weight:700;line-height:1.4;">Technical Details</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;">
                ${informationRow("Browser / agent", report.userAgent)}
                ${informationRow("Environment", report.environment)}
                ${informationRow("Page URL", report.pageUrl)}
              </table>

              <h2 style="margin:26px 0 10px;padding-top:24px;border-top:1px solid #e8e9ed;color:#17113f;font-size:15px;font-weight:700;line-height:1.4;">Description</h2>
              <div style="padding:17px 18px;border:1px solid #dedfe5;border-left:3px solid #7c3aed;border-radius:8px;background:#f8f8fa;color:#292342;font-size:14px;line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap;word-break:break-word;">${escapeHtml(report.description)}</div>

              <p style="margin:28px 0 0;color:#918ca1;font-size:11px;line-height:1.5;">Generated automatically by Prelude Support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const result = await sendContactEmail({
    env,
    to: supportEmail,
    subject: `[Prelude Bug Report] ${report.category} - ${report.title}`,
    html
  });
  if (!result.delivered) {
    const error = new Error("Bug report email could not be delivered.");
    error.statusCode = 503;
    error.code = result.reason === "missing_provider" ? "email_not_configured" : "email_delivery_failed";
    error.details = {
      reason: result.reason,
      providerStatus: result.status,
      providerMessage: result.providerMessage
    };
    throw error;
  }
  return { message: "Thanks — your bug report was sent to Prelude Support." };
}
