import { handleBillingReactivate } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingReactivate(context);
}
