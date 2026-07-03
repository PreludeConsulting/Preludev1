import { z } from "zod";
import {
  CONTACT_EMAIL,
  CONTACT_TIME_ZONE,
  CONTACT_TIME_ZONE_ID,
  buildAvailableCallSlots,
  formatDateLabel,
  formatTimeLabel
} from "../../src/lib/contactSchedule.js";

export const contactBookingSchema = z.object({
  selectedDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  selectedTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  studentYear: z.string().trim().max(80).optional().default(""),
  topic: z.string().trim().max(2000).optional().default("")
});

function resolveRuntimeEnv(env) {
  if (env) return env;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function getSupportEmail(env) {
  return (env.CONTACT_SUPPORT_EMAIL || CONTACT_EMAIL).trim();
}

function getEmailFrom(env) {
  return (env.AUTH_EMAIL_FROM || "Prelude <no-reply@preludeconsultingllc.com>").trim();
}

function getEasternParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CONTACT_TIME_ZONE_ID,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
}

export function easternDateTimeToUtc(isoDate, time24) {
  const [targetYear, targetMonth, targetDay] = isoDate.split("-").map(Number);
  const [targetHour, targetMinute] = time24.split(":").map(Number);
  let guess = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour + 5, targetMinute));

  for (let index = 0; index < 4; index += 1) {
    const parts = getEasternParts(guess);
    const targetUtcMinutes = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute) / 60000;
    const guessEasternMinutes = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) / 60000;
    const deltaMinutes = targetUtcMinutes - guessEasternMinutes;
    if (deltaMinutes === 0) break;
    guess = new Date(guess.getTime() + deltaMinutes * 60 * 1000);
  }

  const finalParts = getEasternParts(guess);
  if (
    finalParts.year !== targetYear ||
    finalParts.month !== targetMonth ||
    finalParts.day !== targetDay ||
    finalParts.hour !== targetHour ||
    finalParts.minute !== targetMinute
  ) {
    const error = new Error("Selected time is not available.");
    error.statusCode = 400;
    error.code = "invalid_selected_time";
    throw error;
  }

  return guess;
}

function assertAvailableSlot({ selectedDate, selectedTime }, now = new Date()) {
  const availableSlots = buildAvailableCallSlots({ now });
  if (!availableSlots[selectedDate]?.includes(selectedTime)) {
    const error = new Error("That call time is no longer available. Please choose another time.");
    error.statusCode = 409;
    error.code = "slot_unavailable";
    throw error;
  }
}

function buildBookingDetails(parsed, env) {
  const supportEmail = getSupportEmail(env);

  return {
    customer_name: parsed.name,
    customer_email: normalizeEmail(parsed.email),
    student_year: parsed.studentYear || null,
    topic: parsed.topic || null,
    selected_date: parsed.selectedDate,
    selected_time: parsed.selectedTime,
    support_email: supportEmail
  };
}

function detailRows(details) {
  return [
    ["Name", details.customer_name],
    ["Email", details.customer_email],
    ["Student year", details.student_year || "Not provided"],
    ["Requested time", `${formatDateLabel(details.selected_date)} at ${formatTimeLabel(details.selected_time)} (${CONTACT_TIME_ZONE})`],
    ["Topic", details.topic || "No topic provided"]
  ]
    .map(([label, value]) => `<p style="margin:0 0 10px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`)
    .join("");
}

function emailShell({ heading, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4ff;font-family:Arial,Helvetica,sans-serif;color:#17113f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ff;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5ddff;border-radius:12px;padding:28px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#7c3aed;font-weight:700;">Prelude</p>
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#120c45;">${escapeHtml(heading)}</h1>
          ${body}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildSupportEmail(details) {
  return emailShell({
    heading: "New discovery call request",
    body: `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#3f3963;">A customer requested a Prelude discovery call.</p>
      ${detailRows(details)}
    `
  });
}

export async function sendContactEmail({ env, to, subject, html }) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const apiKey = runtimeEnv.RESEND_API_KEY?.trim();
  const from = getEmailFrom(runtimeEnv);
  if (!apiKey || !from) {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      delivered: false,
      reason: "provider_error",
      status: response.status,
      providerMessage: payload?.message || payload?.error?.message || "Email provider failed."
    };
  }

  return { delivered: true, id: payload.id || null };
}

function assertEmailDelivered(result, message) {
  if (result.delivered) return;
  const error = new Error(message);
  error.statusCode = 503;
  error.code = result.reason === "missing_provider" ? "email_not_configured" : "email_delivery_failed";
  throw error;
}

export async function bookContactCall({ env = process.env, payload }) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const parsed = contactBookingSchema.parse(payload);
  assertAvailableSlot(parsed);
  const details = buildBookingDetails(parsed, runtimeEnv);
  const supportResult = await sendContactEmail({
    env: runtimeEnv,
    to: details.support_email,
    subject: `New discovery call request - ${formatDateLabel(details.selected_date)} at ${formatTimeLabel(details.selected_time)}`,
    html: buildSupportEmail(details)
  });

  assertEmailDelivered(supportResult, "We could not notify Prelude support right now. Please try again in a moment.");

  return {
    message: "Discovery call request received.",
    emailSent: true
  };
}
