import { handleContactAvailability } from "../../_lib/contactBookings.js";

export function onRequest(context) {
  return handleContactAvailability(context);
}
