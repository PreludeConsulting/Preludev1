import { createChatCompletion } from "../server/chatHandler.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "bad_request", message: "messages must be an array" });
      return;
    }

    const result = await createChatCompletion(messages, {}, req.body?.profile ?? null);
    res.status(200).json(result);
  } catch (error) {
    if (error.code === "NOT_CONFIGURED") {
      res.status(503).json({ error: "not_configured", message: error.message });
      return;
    }

    console.error("[prelude-chat-api]", error);
    res.status(502).json({
      error: "upstream_error",
      message: error.message ?? "Chat request failed"
    });
  }
}
