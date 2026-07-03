import { handleContactBookCall } from "../../_lib/contactBookings.js";

export function onRequest(context) {
  return handleContactBookCall(context);
}
