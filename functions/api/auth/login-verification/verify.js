import { handleLoginVerification } from "../../../_lib/loginVerification.js";

export function onRequest(context) {
  return handleLoginVerification(context, "verify");
}
