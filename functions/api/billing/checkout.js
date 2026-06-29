import { handleBillingCheckout } from "../../_lib/stripeBilling.js";

export function onRequest(context) {
  return handleBillingCheckout(context);
}
