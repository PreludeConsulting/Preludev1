import { handleBillingSyncSubscription } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingSyncSubscription(context);
}
