import { createAuthApiMiddleware } from "./authApi.js";

const middleware = createAuthApiMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found" }));
  });
}
