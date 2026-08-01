import { handleMentorReview } from "../../../_lib/mentorReview.js";

export function onRequest(context) {
  return handleMentorReview(context, "list");
}
