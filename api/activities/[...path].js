import { createMentorActivitiesApiMiddleware } from "../../server/mentorActivitiesApi.js";
import { sendJson } from "../../server/http.js";

const middleware = createMentorActivitiesApiMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found", message: "Activity route not found." }));
}
