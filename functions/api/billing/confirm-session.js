import { handleBillingConfirmSession } from "../../_lib/stripeBilling.js";

export function onRequest(context) {
  return handleBillingConfirmSession(context);
}
