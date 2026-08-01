import { handleStudentAccess } from "../../_lib/activities.js";

export async function onRequest(context) {
  return handleStudentAccess(context);
}
