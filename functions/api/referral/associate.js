import { onRequest as handle } from "../../_lib/referralApi.js";
export function onRequest(context) {
  return handle(context);
}
