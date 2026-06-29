import { handleBillingConfig } from "../../_lib/stripeBilling.js";

export function onRequest(context) {
  return handleBillingConfig(context);
}
