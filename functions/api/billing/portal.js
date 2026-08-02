import { handleBillingPortal } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingPortal(context);
}
