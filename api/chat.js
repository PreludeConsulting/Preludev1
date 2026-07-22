import { createMentorMatch } from "../server/mentorMatch.js";
import { createRagChatCompletion } from "../server/chatHandler.js";
import { db, requireAuth } from "../server/authApi.js";
import { mergeStudentProfileForChat } from "../server/rag/studentProfile.js";
import { mapChatError, shouldLogChatError } from "../server/chatErrors.js";
import { validateChatRequestBody } from "../server/chatRequest.js";
import { sanitizeStudentProfile } from "../server/rag/studentProfile.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    async function loadStudentProfileSummary() {
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
        const clientProfile = req.body?.profile && typeof req.body.profile === "object" ? req.body.profile : {};
        return mergeStudentProfileForChat({ user, studentProfile, clientProfile });
      } catch {
        return req.body?.profile && typeof req.body.profile === "object"
          ? sanitizeStudentProfile(req.body.profile)
          : null;
      }
    }

    const request = validateChatRequestBody(req.body);
    if (request?.kind === "mentor_match") {
      const result = await createMentorMatch(request.mentorMatch);
      res.status(200).json(result);
      return;
    }
    if (request?.kind === "message") {
      const profile = (await loadStudentProfileSummary()) ?? sanitizeStudentProfile(request.profile || {});
      const result = await createRagChatCompletion(
        {
          message: request.message,
          conversationHistory: request.conversationHistory
        },
        undefined,
        profile
      );
      res.status(200).json(result);
      return;
    }

    res.status(400).json({
      error: "invalid_chat_request",
      message: "Send either mentorMatch payload or a message string."
    });
  } catch (error) {
    if (error?.code === "CHAT_REQUEST_TOO_LARGE" || error?.code === "INVALID_CHAT_REQUEST") {
      return res.status(error.statusCode).json({ error: error.code.toLowerCase(), message: error.message });
    }
    if (shouldLogChatError(error)) {
      console.error("[prelude-chat-api]", error.message ?? error);
    }
    const mapped = mapChatError(error);
    res.status(mapped.status).json(mapped.body);
  }
}
