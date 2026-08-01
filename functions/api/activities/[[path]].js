import { handleActivities } from "../../_lib/activities.js";

export async function onRequest(context) {
  return handleActivities(context);
}
