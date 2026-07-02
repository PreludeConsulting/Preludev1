import { createMentorMatch } from "../server/mentorMatch.js";
import { createRagChatCompletion } from "../server/chatHandler.js";
import { mapChatError, shouldLogChatError } from "../server/chatErrors.js";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_ITEMS = 12;

function sanitizeProfile(profile) {
  if (!profile || typeof profile !== "object") return null;

  return {
    name: typeof profile.name === "string" ? profile.name.slice(0, 120) : undefined,
    planName: typeof profile.planName === "string" ? profile.planName.slice(0, 80) : undefined,
    plan: typeof profile.plan === "string" ? profile.plan.slice(0, 80) : undefined,
    role: typeof profile.role === "string" ? profile.role.slice(0, 80) : undefined,
    grade: typeof profile.grade === "string" || typeof profile.grade === "number" ? String(profile.grade).slice(0, 40) : undefined,
    focus: typeof profile.focus === "string" ? profile.focus.slice(0, 160) : undefined,
    intendedMajor: typeof profile.intendedMajor === "string" ? profile.intendedMajor.slice(0, 160) : undefined,
    major: typeof profile.major === "string" ? profile.major.slice(0, 160) : undefined,
    gpa: typeof profile.gpa === "string" || typeof profile.gpa === "number" ? String(profile.gpa).slice(0, 20) : undefined,
    interests: Array.isArray(profile.interests)
      ? profile.interests.map((item) => String(item).slice(0, 80)).slice(0, 12)
      : typeof profile.interests === "string"
        ? profile.interests.slice(0, 240)
        : undefined,
    goals: Array.isArray(profile.goals)
      ? profile.goals.map((item) => String(item).slice(0, 120)).slice(0, 12)
      : typeof profile.goals === "string"
        ? profile.goals.slice(0, 320)
        : undefined
  };
}

function sanitizeConversationHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item?.role === "user" || item?.role === "assistant")
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? item.text ?? "").slice(0, MAX_MESSAGE_LENGTH)
    }))
    .filter((item) => item.content.trim().length > 0);
}

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
    if (req.body?.mentorMatch) {
      const result = await createMentorMatch(req.body.mentorMatch);
      res.status(200).json(result);
      return;
    }

    const message = String(req.body?.message ?? "").trim();
    if (!message) {
      res.status(400).json({ error: "bad_request", message: "message is required" });
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: "bad_request",
        message: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`
      });
      return;
    }

    const result = await createRagChatCompletion(
      {
        message,
        conversationHistory: sanitizeConversationHistory(req.body?.conversationHistory)
      },
      {},
      sanitizeProfile(req.body?.profile)
    );

    res.status(200).json(result);
  } catch (error) {
    if (shouldLogChatError(error)) {
      console.error("[prelude-chat-api]", error.message ?? error);
    }
    const mapped = mapChatError(error);
    res.status(mapped.status).json(mapped.body);
  }
}
