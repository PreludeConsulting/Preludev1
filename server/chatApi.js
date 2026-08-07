import { db, requireAuth } from "./authApi.js";
import { isLegacyPrismaAuthEnabled } from "./lib/legacyPrismaAuth.js";
import { readJsonBody, sendJson } from "./http.js";
import { hasAuthenticatedRequest } from "./lib/dataOwnership.js";
import { mergeStudentProfileForChat } from "./rag/studentProfile.js";
import { sanitizeStudentProfile } from "./rag/studentProfile.js";
import { validateChatRequestBody } from "./chatRequest.js";
import { isPreludeAiEnabled, PRELUDE_AI_DISABLED_MESSAGE } from "../shared/preludeAiEnabled.js";
import { buildChatModelConfig } from "./aiConfig.js";
import { createMentorMatch } from "./mentorMatch.js";
import { mapChatError, shouldLogChatError } from "./chatErrors.js";
import { createRagChatCompletion } from "./chatHandler.js";

export function createChatApiMiddleware(env = process.env, deps = {}) {
  const config = buildChatModelConfig(env);
  const requireAuthFn =
    deps.requireAuthFn ||
    (async (req) => {
      if (!isLegacyPrismaAuthEnabled(env)) {
        const error = new Error("Authentication required.");
        error.statusCode = 401;
        throw error;
      }
      return requireAuth(req);
    });
  const dbFactory = deps.dbFactory || db;
  const createRagChatCompletionFn = deps.createRagChatCompletionFn || createRagChatCompletion;
  const createMentorMatchFn = deps.createMentorMatchFn || createMentorMatch;

  async function loadStudentProfileSummary(req, body = {}) {
    const authenticatedRequest = hasAuthenticatedRequest(req);
    try {
      const { user } = await requireAuthFn(req);
      const studentProfile = await dbFactory().studentProfile.findUnique({
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
      return mergeStudentProfileForChat({ user, studentProfile, clientProfile: {} });
    } catch {
      if (authenticatedRequest) return null;
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

    if (!isPreludeAiEnabled(env)) {
      sendJson(res, 503, {
        error: "prelude_ai_disabled",
        message: PRELUDE_AI_DISABLED_MESSAGE
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const request = validateChatRequestBody(body);

      if (request?.kind === "mentor_match") {
        const result = await createMentorMatchFn(request.mentorMatch, config);
        sendJson(res, 200, result);
        return;
      }
      if (request?.kind === "message") {
        const ownedProfile = await loadStudentProfileSummary(req, body);
        const profile = ownedProfile ?? (hasAuthenticatedRequest(req) ? null : sanitizeStudentProfile(request.profile || {}));
        const result = await createRagChatCompletionFn(
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
