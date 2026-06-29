import { handleTrustedDevices } from "../../../_lib/loginVerification.js";

export function onRequest(context) {
  return handleTrustedDevices(context);
}
