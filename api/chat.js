import { createMentorMatch } from "../server/mentorMatch.js";
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
    if (req.body?.mentorMatch) {
      const result = await createMentorMatch(req.body.mentorMatch);
      res.status(200).json(result);
      return;
    }
    res.status(410).json({
      error: "guided_assistant_only",
      message: "Open-ended admissions chat has been replaced by the guided assistant. AI is available only after a completed mentor questionnaire."
    });
  } catch (error) {
    if (shouldLogChatError(error)) {
      console.error("[prelude-chat-api]", error.message ?? error);
    }
    const mapped = mapChatError(error);
    res.status(mapped.status).json(mapped.body);
  }
}
