import { handleMentorSelection } from "../../_lib/mentorSelection.js";

export function onRequest(context) {
  return handleMentorSelection(context);
}
