export function readJsonBody(req) {
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    } catch (error) {
      return Promise.reject(error);
    }
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(req.body)) {
    try {
      const raw = req.body.toString("utf8");
      return Promise.resolve(raw ? JSON.parse(raw) : {});
    } catch (error) {
      return Promise.reject(error);
    }
  }
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return Promise.resolve(req.body);
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

export function getRequestUrl(req) {
  return new URL(req.url ?? "/", "http://localhost");
}
