import { handleMeetings } from "../../_lib/meetings.js";

export async function onRequest(context) {
  return handleMeetings(context, "by-id");
}
