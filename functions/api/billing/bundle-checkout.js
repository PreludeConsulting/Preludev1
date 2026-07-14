import { handleBillingBundleCheckout } from "../../_lib/stripeBilling.js";

export function onRequest(context) {
  return handleBillingBundleCheckout(context);
}
