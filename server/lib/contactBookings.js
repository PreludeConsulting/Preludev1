import { z } from "zod";
import {
  CONTACT_EMAIL,
  CONTACT_TIME_ZONE,
  CONTACT_TIME_ZONE_ID,
  DISCOVERY_CALL_MINUTES,
  buildAvailableCallSlots,
  formatDateLabel,
  formatTimeLabel
} from "../../src/lib/contactSchedule.js";
import { createSupabaseAdmin } from "./supabasePasswordReset.js";

const CONTACT_BOOKINGS_TABLE = "contact_call_bookings";
const REMINDER_LEAD_MINUTES = 30;

export const contactBookingSchema = z.object({
  selectedDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  selectedTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
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

function getSupportPhone(env) {
  return (env.CONTACT_SUPPORT_PHONE || "").trim();
}

function getContactInstructions(env) {
  return (env.CONTACT_INSTRUCTIONS || "").trim();
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

function buildContactRows(parsed, env) {
  const supportEmail = getSupportEmail(env);
  const appointmentStartAt = easternDateTimeToUtc(parsed.selectedDate, parsed.selectedTime);
  const reminderSendAfterAt = new Date(appointmentStartAt.getTime() - REMINDER_LEAD_MINUTES * 60 * 1000);

  return {
    customer_name: parsed.name,
    customer_email: normalizeEmail(parsed.email),
    customer_phone: parsed.phone || null,
    student_year: parsed.studentYear || null,
    topic: parsed.topic || null,
    selected_date: parsed.selectedDate,
    selected_time: parsed.selectedTime,
    appointment_start_at: appointmentStartAt.toISOString(),
    reminder_send_after_at: reminderSendAfterAt.toISOString(),
    support_email: supportEmail,
    support_phone: getSupportPhone(env) || null,
    contact_instructions: getContactInstructions(env) || null,
    status: "requested"
  };
}

function detailRows(details) {
  return [
    ["Name", details.customer_name],
    ["Email", details.customer_email],
    ["Phone", details.customer_phone || "Not provided"],
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

function buildCustomerConfirmationEmail(details, env) {
  const supportPhone = details.support_phone || getSupportPhone(env);
  const phoneLine = supportPhone
    ? `<p style="margin:0 0 10px;"><strong>Phone/contact:</strong> ${escapeHtml(supportPhone)}</p>`
    : "";

  return emailShell({
    heading: "Your Prelude discovery call request",
    body: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3963;">Hi ${escapeHtml(details.customer_name)}, we received your request for a ${DISCOVERY_CALL_MINUTES}-minute discovery call.</p>
      <p style="margin:0 0 10px;"><strong>Requested time:</strong> ${escapeHtml(formatDateLabel(details.selected_date))} at ${escapeHtml(formatTimeLabel(details.selected_time))} (${escapeHtml(CONTACT_TIME_ZONE)})</p>
      <p style="margin:0 0 10px;"><strong>Support email:</strong> ${escapeHtml(details.support_email)}</p>
      ${phoneLine}
      <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b628d;">We will send our contact information again 30 minutes before the call.</p>
    `
  });
}

function buildReminderEmail(details, env) {
  const supportPhone = details.support_phone || getSupportPhone(env);
  const contactInstructions = details.contact_instructions || getContactInstructions(env);
  const phoneLine = supportPhone
    ? `<p style="margin:0 0 10px;"><strong>Phone/contact:</strong> ${escapeHtml(supportPhone)}</p>`
    : "";
  const instructionsLine = contactInstructions
    ? `<p style="margin:0 0 10px;"><strong>Call details:</strong> ${escapeHtml(contactInstructions)}</p>`
    : "";

  return emailShell({
    heading: "Your Prelude call starts soon",
    body: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3963;">Your Prelude discovery call is scheduled in about 30 minutes.</p>
      <p style="margin:0 0 10px;"><strong>Time:</strong> ${escapeHtml(formatDateLabel(details.selected_date))} at ${escapeHtml(formatTimeLabel(details.selected_time))} (${escapeHtml(CONTACT_TIME_ZONE)})</p>
      <p style="margin:0 0 10px;"><strong>Support email:</strong> ${escapeHtml(details.support_email)}</p>
      ${phoneLine}
      ${instructionsLine}
      <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b628d;">Reply to this email if anything changes before your call.</p>
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
  const admin = createSupabaseAdmin(runtimeEnv);
  if (!admin) {
    const error = new Error("Booking reminders are not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    error.statusCode = 503;
    error.code = "booking_storage_unavailable";
    throw error;
  }

  const parsed = contactBookingSchema.parse(payload);
  assertAvailableSlot(parsed);
  const row = buildContactRows(parsed, runtimeEnv);

  const { data: inserted, error: insertError } = await admin
    .from(CONTACT_BOOKINGS_TABLE)
    .insert(row)
    .select("id")
    .single();

  if (insertError) {
    const error = new Error("Could not save the booking request.");
    error.statusCode = 503;
    error.code = "booking_storage_failed";
    error.cause = insertError;
    throw error;
  }

  const details = { id: inserted.id, ...row };
  const supportResult = await sendContactEmail({
    env: runtimeEnv,
    to: row.support_email,
    subject: `New discovery call request - ${formatDateLabel(row.selected_date)} at ${formatTimeLabel(row.selected_time)}`,
    html: buildSupportEmail(details)
  });
  const confirmationResult = await sendContactEmail({
    env: runtimeEnv,
    to: row.customer_email,
    subject: "Your Prelude discovery call request",
    html: buildCustomerConfirmationEmail(details, runtimeEnv)
  });

  await admin
    .from(CONTACT_BOOKINGS_TABLE)
    .update({
      support_email_sent_at: supportResult.delivered ? new Date().toISOString() : null,
      confirmation_email_sent_at: confirmationResult.delivered ? new Date().toISOString() : null,
      support_resend_id: supportResult.id || null,
      confirmation_resend_id: confirmationResult.id || null,
      status: supportResult.delivered && confirmationResult.delivered ? "emails_sent" : "email_failed",
      updated_at: new Date().toISOString()
    })
    .eq("id", inserted.id);

  assertEmailDelivered(supportResult, "We could not notify Prelude support right now. Please try again in a moment.");
  assertEmailDelivered(confirmationResult, "We could not send your confirmation email right now. Please try again in a moment.");

  return {
    message: "Discovery call request received.",
    bookingId: inserted.id,
    emailSent: true,
    reminderScheduled: true
  };
}

export async function sendDueContactReminders({ env = process.env, limit = 25 } = {}) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const admin = createSupabaseAdmin(runtimeEnv);
  if (!admin) {
    const error = new Error("Supabase server credentials are not configured.");
    error.statusCode = 503;
    error.code = "booking_storage_unavailable";
    throw error;
  }

  const nowIso = new Date().toISOString();
  const { data: bookings, error: queryError } = await admin
    .from(CONTACT_BOOKINGS_TABLE)
    .select("*")
    .is("reminder_sent_at", null)
    .lte("reminder_send_after_at", nowIso)
    .gt("appointment_start_at", nowIso)
    .neq("status", "canceled")
    .order("appointment_start_at", { ascending: true })
    .limit(limit);

  if (queryError) {
    const error = new Error("Could not load due contact reminders.");
    error.statusCode = 503;
    error.code = "reminder_query_failed";
    error.cause = queryError;
    throw error;
  }

  let sent = 0;
  const failed = [];

  for (const booking of bookings || []) {
    const result = await sendContactEmail({
      env: runtimeEnv,
      to: booking.customer_email,
      subject: "Your Prelude call starts soon",
      html: buildReminderEmail(booking, runtimeEnv)
    });

    if (result.delivered) {
      sent += 1;
      await admin
        .from(CONTACT_BOOKINGS_TABLE)
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_resend_id: result.id || null,
          status: "reminder_sent",
          updated_at: new Date().toISOString()
        })
        .eq("id", booking.id);
    } else {
      failed.push({ id: booking.id, reason: result.reason || "email_delivery_failed" });
    }
  }

  return {
    checked: bookings?.length || 0,
    sent,
    failed
  };
}
