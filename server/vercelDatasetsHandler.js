import { createDatasetsApiMiddleware } from "./datasetsApi.js";

const middleware = createDatasetsApiMiddleware();

function buildPath(req, pathname) {
  const query =
    req.query && typeof req.query === "object"
      ? new URLSearchParams(
          Object.entries(req.query).flatMap(([key, value]) => {
            if (Array.isArray(value)) return value.map((item) => [key, item]);
            if (value != null) return [[key, String(value)]];
            return [];
          })
        ).toString()
      : "";
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function createVercelDatasetsHandler(pathname) {
  return async function handler(req, res) {
    req.url = buildPath(req, pathname);
    await new Promise((resolve) => {
      middleware(req, res, () => {
        if (!res.writableEnded) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "not_found" }));
        }
        resolve();
      });
    });
  };
}
