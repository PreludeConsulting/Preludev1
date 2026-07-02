import { buildChatModelConfig } from "./aiConfig.js";
import { createMentorMatch } from "./mentorMatch.js";
import { mapChatError, shouldLogChatError } from "./chatErrors.js";
import { createRagChatCompletion } from "./chatHandler.js";
import { db, requireAuth } from "./authApi.js";
import { readJsonBody, sendJson } from "./http.js";
import { mergeStudentProfileForChat } from "./rag/studentProfile.js";

export function createChatApiMiddleware(env = process.env) {
  const config = buildChatModelConfig(env);

  async function loadStudentProfileSummary(req, body = {}) {
    try {
      const { user } = await requireAuth(req);
      const studentProfile = await db().studentProfile.findUnique({
        where: { userId: user.id },
        select: {
          graduationYear: true,
          highSchool: true,
          location: true,
          targetMajors: true,
          gpa: true,
          testScores: true,
          preferences: true,
          progress: true
        }
      });
      const clientProfile = body.profile && typeof body.profile === "object" ? body.profile : {};
      return mergeStudentProfileForChat({ user, studentProfile, clientProfile });
    } catch {
      return body.profile && typeof body.profile === "object" ? body.profile : null;
    }
  }

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
      if (typeof body.message === "string" && body.message.trim()) {
        const profile = (await loadStudentProfileSummary(req, body)) ?? body.profile ?? null;
        const result = await createRagChatCompletion(
          {
            message: body.message,
            conversationHistory: Array.isArray(body.conversationHistory) ? body.conversationHistory : []
          },
          config,
          profile
        );
        sendJson(res, 200, result);
        return;
      }
      sendJson(res, 400, {
        error: "invalid_chat_request",
        message: "Send either mentorMatch payload or a message string."
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
