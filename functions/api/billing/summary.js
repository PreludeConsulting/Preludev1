import { handleBillingSummary } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleBillingSummary(context);
}
