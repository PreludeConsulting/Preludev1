import { handleParentInviteSend } from "../../_lib/parentInvites.js";

export function onRequest(context) {
  return handleParentInviteSend(context);
}
