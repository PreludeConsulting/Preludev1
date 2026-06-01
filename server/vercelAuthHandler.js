import { createAuthApiMiddleware } from "./preludeAuthApi.js";

const middleware = createAuthApiMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found" }));
  });
}
