import { handleMySubscription } from "../../_lib/billingMembershipApi.js";

export function onRequest(context) {
  return handleMySubscription(context);
}
