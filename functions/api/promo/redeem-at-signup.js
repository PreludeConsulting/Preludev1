import { handlePromoRedeemAtSignup } from "../../_lib/promoCodesApi.js";

export function onRequest(context) {
  return handlePromoRedeemAtSignup(context);
}
