import { handleParentInviteCompleteStep } from "../../_lib/parentInvites.js";

export function onRequest(context) {
  return handleParentInviteCompleteStep(context);
}
