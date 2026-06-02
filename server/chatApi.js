import { buildChatModelConfig } from "./aiConfig.js";
import { createChatCompletion, createRagChatCompletion } from "./chatHandler.js";
import { buildServiceErrorFallback } from "./rag/fallback.js";
import { mapChatError, shouldLogChatError } from "./chatErrors.js";
import { readJsonBody, sendJson } from "./http.js";

export function createChatApiMiddleware(env = process.env) {
  const config = buildChatModelConfig(env);

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
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    let requestBody = null;

    try {
      requestBody = await readJsonBody(req);
      const body = requestBody;

      if (typeof body.message === "string") {
        const result = await createRagChatCompletion(
          {
            message: body.message,
            conversationHistory: body.conversationHistory ?? []
          },
          config,
          body.profile ?? null
        );
        sendJson(res, 200, result);
        return;
      }

      const messages = body.messages;
      if (!Array.isArray(messages)) {
        sendJson(res, 400, {
          error: "bad_request",
          message: "Provide message or messages in the request body."
        });
        return;
      }

      const result = await createChatCompletion(messages, config, body.profile ?? null);
      sendJson(res, 200, result);
    } catch (error) {
      if (shouldLogChatError(error)) {
        console.error("[prelude-chat-api]", error.message ?? error);
      }

      const fallbackResponse = buildServiceErrorFallback(error);
      if (fallbackResponse && typeof requestBody?.message === "string") {
        sendJson(res, 200, fallbackResponse);
        return;
      }

      const mapped = mapChatError(error);
      sendJson(res, mapped.status, mapped.body);
    }
  };
}
