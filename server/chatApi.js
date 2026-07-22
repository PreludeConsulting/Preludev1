import { buildChatModelConfig } from "./aiConfig.js";
import { createMentorMatch } from "./mentorMatch.js";
import { mapChatError, shouldLogChatError } from "./chatErrors.js";
import { createRagChatCompletion } from "./chatHandler.js";
import { db, requireAuth } from "./authApi.js";
import { readJsonBody, sendJson } from "./http.js";
import { mergeStudentProfileForChat } from "./rag/studentProfile.js";
import { sanitizeStudentProfile } from "./rag/studentProfile.js";
import { validateChatRequestBody } from "./chatRequest.js";

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
      return body.profile && typeof body.profile === "object" ? sanitizeStudentProfile(body.profile) : null;
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
      const request = validateChatRequestBody(body);

      if (request?.kind === "mentor_match") {
        const result = await createMentorMatch(request.mentorMatch, config);
        sendJson(res, 200, result);
        return;
      }
      if (request?.kind === "message") {
        const profile = (await loadStudentProfileSummary(req, body)) ?? sanitizeStudentProfile(request.profile || {});
        const result = await createRagChatCompletion(
          {
            message: request.message,
            conversationHistory: request.conversationHistory
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
      if (error?.code === "CHAT_REQUEST_TOO_LARGE" || error?.code === "INVALID_CHAT_REQUEST") {
        return sendJson(res, error.statusCode, { error: error.code.toLowerCase(), message: error.message });
      }
      if (shouldLogChatError(error)) {
        console.error("[prelude-chat-api]", error.message ?? error);
      }

      const mapped = mapChatError(error);
      sendJson(res, mapped.status, mapped.body);
    }
  };
}
