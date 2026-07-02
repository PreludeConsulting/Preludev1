import { handleSendSignupVerification } from "../../_lib/supabaseSignupVerification.js";

export function onRequest(context) {
  return handleSendSignupVerification(context);
}
