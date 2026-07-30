import { createAuthApiMiddleware } from "./authApi.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";

const middleware = createAuthApiMiddleware();

function authHandler(req, res) {
  return middleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found" }));
  });
}

export default withApiRateLimit(authHandler);
