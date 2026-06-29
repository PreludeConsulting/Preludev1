import { handleBillingWebhook } from "../../_lib/stripeBilling.js";

export function onRequest(context) {
  return handleBillingWebhook(context);
}
