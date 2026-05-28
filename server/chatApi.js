import { createChatCompletion } from "./chatHandler.js";

function readJsonBody(req) {
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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function createChatApiMiddleware(env = {}) {
  const config = {
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL
  };

  return async function chatApiMiddleware(req, res, next) {
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/api/chat") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const messages = body.messages;

      if (!Array.isArray(messages)) {
        sendJson(res, 400, { error: "messages must be an array" });
        return;
      }

      const result = await createChatCompletion(messages, config, body.profile ?? null);
      sendJson(res, 200, result);
    } catch (error) {
      if (error.code === "NOT_CONFIGURED") {
        sendJson(res, 503, { error: "not_configured", message: error.message });
        return;
      }
      if (error.code === "BAD_REQUEST") {
        sendJson(res, 400, { error: "bad_request", message: error.message });
        return;
      }

      console.error("[prelude-chat-api]", error);
      sendJson(res, 502, {
        error: "upstream_error",
        message: error.message ?? "Chat request failed"
      });
    }
  };
}
