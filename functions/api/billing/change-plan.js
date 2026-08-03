import { handleBillingChangePlan } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingChangePlan(context);
}
