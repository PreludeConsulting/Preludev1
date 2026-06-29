export function readJsonBody(req) {
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
