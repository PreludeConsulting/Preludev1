import { handleBillingPortal } from "../../_lib/stripeBilling.js";

export function onRequest(context) {
  return handleBillingPortal(context);
}
