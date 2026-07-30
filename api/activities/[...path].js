import { createMentorActivitiesApiMiddleware } from "../../server/mentorActivitiesApi.js";
import { sendJson } from "../../server/http.js";
import { withApiRateLimit } from "../../server/lib/apiRateLimitMiddleware.js";

const middleware = createMentorActivitiesApiMiddleware();

function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found", message: "Activity route not found." }));
}

export default withApiRateLimit(handler);
