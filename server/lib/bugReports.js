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

function row(label, value) {
  return `<tr><th align="left" style="padding:7px 12px 7px 0;vertical-align:top;color:#655d82;white-space:nowrap;">${escapeHtml(label)}</th><td style="padding:7px 0;word-break:break-word;">${escapeHtml(value || "Not available")}</td></tr>`;
}

export async function sendBugReport({ env = process.env, payload, verifiedAccount }) {
  const report = bugReportSchema.parse(payload);
  const account = verifiedAccount || report.account || {};
  const timestamp = new Date().toISOString();
  const supportEmail = (env.BUG_REPORT_EMAIL || env.CONTACT_SUPPORT_EMAIL || "preludesupport@preludeconsultingllc.com").trim();
  const rows = [
    row("Category", report.category), row("Title", report.title),
    row("Page URL", report.pageUrl), row("User name", account.name),
    row("User email", account.email), row("User role", account.role),
    row("User ID", account.userId), row("Browser / user agent", report.userAgent),
    row("Environment", report.environment), row("Timestamp", timestamp)
  ].join("");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f4ff;font-family:Arial,sans-serif;color:#17113f;"><main style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5ddff;border-radius:14px;padding:28px;"><p style="margin:0 0 8px;color:#7c3aed;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Prelude bug report</p><h1 style="margin:0 0 22px;font-size:23px;">${escapeHtml(report.title)}</h1><table style="width:100%;font-size:14px;line-height:1.45;">${rows}</table><h2 style="margin:24px 0 10px;font-size:16px;">Description</h2><div style="padding:16px;border-radius:10px;background:#f7f4ff;white-space:pre-wrap;line-height:1.55;">${escapeHtml(report.description)}</div></main></body></html>`;
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
