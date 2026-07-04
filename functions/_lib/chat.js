// Cloudflare Pages Function handler for Prelude AI chat.
// Runs on the Workers runtime, so it uses only Web APIs (fetch) — no Node/fs/Prisma.
// The full local RAG stack (server/chatHandler.js) is Node-only and cannot run here;
// in production we call OpenAI directly using the server-only OPENAI_API_KEY.
//
// Prelude knowledge comes from a single committed module so the public site uses
// the SAME knowledge as local. To add/update knowledge, edit:
//   src/lib/ai/preludeKnowledge.js
import { buildPreludeSystemContext } from "../../src/lib/ai/preludeKnowledge.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_HISTORY = 12;

const SYSTEM_PROMPT = buildPreludeSystemContext();

function json(payload, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers });
}

function buildProfileAddon(profile) {
  if (!profile || typeof profile !== "object") return "";
  const parts = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.grade || profile.graduationYear) parts.push(`Grade/Year: ${profile.grade ?? profile.graduationYear}`);
  if (profile.gpa != null && profile.gpa !== "") parts.push(`GPA: ${profile.gpa}`);
  if (profile.sat != null) parts.push(`SAT: ${profile.sat}`);
  if (profile.act != null) parts.push(`ACT: ${profile.act}`);
  const majors = profile.majors ?? profile.targetMajors;
  if (Array.isArray(majors) && majors.length) parts.push(`Intended majors: ${majors.join(", ")}`);
  if (profile.location) parts.push(`Location: ${profile.location}`);
  if (profile.budget != null) parts.push(`Budget: ${profile.budget}`);
  if (!parts.length) return "";
  return `\n\nStudent profile (use it to personalize; do not repeat it verbatim):\n${parts.join("\n")}`;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? item.text ?? "").trim()
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY);
}

function buildMessages({ message, history, profile }) {
  return [
    { role: "system", content: `${SYSTEM_PROMPT}${buildProfileAddon(profile)}` },
    ...sanitizeHistory(history),
    { role: "user", content: message }
  ];
}

export async function handlePreludeChat(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed", message: "Method not allowed." }, 405, { Allow: "POST" });
  }

  const apiKey = env?.OPENAI_API_KEY;
  if (!apiKey) {
    // Frontend treats 503 + not_configured as a silent signal to use its built-in rule-based replies.
    return json({ error: "not_configured", message: "Prelude AI is not configured." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_chat_request", message: "Invalid JSON body." }, 400);
  }

  // Mentor matching posts to this same route but is a separate Node-only feature.
  // Deflect cleanly so the client shows its own "unavailable" fallback instead of a validation error.
  if (body?.mentorMatch) {
    return json({ error: "not_configured", message: "Mentor matching is unavailable right now." }, 503);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return json({ error: "invalid_chat_request", message: "message is required." }, 400);
  }

  const profile = body?.profile && typeof body.profile === "object" ? body.profile : null;
  const messages = buildMessages({ message, history: body?.conversationHistory, profile });
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 700 })
    });

    if (!res.ok) {
      return json({ error: "chat_api_error", message: "Prelude AI could not respond right now." }, 502);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) {
      return json({ error: "chat_api_error", message: "Prelude AI returned an empty response." }, 502);
    }

    return json({
      answer: text,
      text,
      provider: "openai",
      model,
      // Signals the deployed AI used the committed Prelude knowledge (not a bare model call).
      knowledgeSource: "prelude-committed",
      sources: ["Prelude knowledge base"],
      retrievedRecords: []
    });
  } catch {
    return json({ error: "chat_api_error", message: "Prelude AI could not respond right now." }, 502);
  }
}
