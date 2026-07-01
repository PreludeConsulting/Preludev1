import { handleRequestPasswordReset } from "../../_lib/supabasePasswordReset.js";

export function onRequest(context) {
  return handleRequestPasswordReset(context);
}
