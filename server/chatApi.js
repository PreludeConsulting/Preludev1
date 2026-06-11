import { buildChatModelConfig } from "./aiConfig.js";
import { createMentorMatch } from "./mentorMatch.js";
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

    try {
      const body = await readJsonBody(req);

      if (body.mentorMatch) {
        const result = await createMentorMatch(body.mentorMatch, config);
        sendJson(res, 200, result);
        return;
      }
      sendJson(res, 410, {
        error: "guided_assistant_only",
        message: "Open-ended admissions chat has been replaced by the guided assistant. AI is available only after a completed mentor questionnaire."
      });
    } catch (error) {
      if (shouldLogChatError(error)) {
        console.error("[prelude-chat-api]", error.message ?? error);
      }

      const mapped = mapChatError(error);
      sendJson(res, mapped.status, mapped.body);
    }
  };
}
