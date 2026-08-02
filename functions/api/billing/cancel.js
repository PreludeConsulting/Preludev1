import { handleBillingCancel } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingCancel(context);
}
