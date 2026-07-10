import { handlePromoValidate } from "../../_lib/promoCodesApi.js";

export function onRequest(context) {
  return handlePromoValidate(context);
}
