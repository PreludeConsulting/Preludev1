import { handleContactSendReminders } from "../../_lib/contactBookings.js";

export function onRequest(context) {
  return handleContactSendReminders(context);
}
