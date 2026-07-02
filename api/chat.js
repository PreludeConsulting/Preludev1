import { createMentorMatch } from "../server/mentorMatch.js";
import { createRagChatCompletion } from "../server/chatHandler.js";
import { db, requireAuth } from "../server/authApi.js";
import { mergeStudentProfileForChat } from "../server/rag/studentProfile.js";
import { mapChatError, shouldLogChatError } from "../server/chatErrors.js";

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
        return req.body?.profile && typeof req.body.profile === "object" ? req.body.profile : null;
      }
    }

    if (req.body?.mentorMatch) {
      const result = await createMentorMatch(req.body.mentorMatch);
      res.status(200).json(result);
      return;
    }
    if (typeof req.body?.message === "string" && req.body.message.trim()) {
      const profile = (await loadStudentProfileSummary()) ?? req.body?.profile ?? null;
      const result = await createRagChatCompletion(
        {
          message: req.body.message,
          conversationHistory: Array.isArray(req.body?.conversationHistory) ? req.body.conversationHistory : []
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
    if (shouldLogChatError(error)) {
      console.error("[prelude-chat-api]", error.message ?? error);
    }
    const mapped = mapChatError(error);
    res.status(mapped.status).json(mapped.body);
  }
}
