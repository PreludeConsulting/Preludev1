import { createChatCompletion, createRagChatCompletion } from "../server/chatHandler.js";
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
    if (typeof req.body?.message === "string") {
      const result = await createRagChatCompletion(
        {
          message: req.body.message,
          conversationHistory: req.body.conversationHistory ?? []
        },
        {},
        req.body?.profile ?? null
      );
      res.status(200).json(result);
      return;
    }

    const messages = req.body?.messages;
    if (!Array.isArray(messages)) {
      res.status(400).json({
        error: "bad_request",
        message: "Provide message or messages in the request body."
      });
      return;
    }

    const result = await createChatCompletion(messages, {}, req.body?.profile ?? null);
    res.status(200).json(result);
  } catch (error) {
    if (shouldLogChatError(error)) {
      console.error("[prelude-chat-api]", error.message ?? error);
    }
    const mapped = mapChatError(error);
    res.status(mapped.status).json(mapped.body);
  }
}
