import { handleBillingHistory } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingHistory(context);
}
