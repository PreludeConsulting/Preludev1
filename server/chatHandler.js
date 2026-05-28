import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentPath = path.join(repoRoot, "AGENT.md");
const knowledgePath = path.join(repoRoot, "AGENT_KNOWLEDGE.md");

function readSystemPrompt() {
  const agent = fs.readFileSync(agentPath, "utf8");
  try {
    const knowledge = fs.readFileSync(knowledgePath, "utf8");
    return `${agent}\n\n---\n\n## Reference knowledge (trusted sources)\n\n${knowledge}`;
  } catch {
    return agent;
  }
}

function buildSystemPrompt(profile) {
  let prompt = readSystemPrompt();
  if (profile?.name && profile?.plan) {
    const lines = [
      "",
      "---",
      "",
      "## Signed-in Prelude member (personalize every reply)",
      `- Name: ${profile.name}`,
      `- Plan: ${profile.planName ?? profile.plan}`,
      profile.role ? `- Role: ${profile.role}` : null,
      profile.grade ? `- Grade: ${profile.grade}` : null,
      profile.focus ? `- Focus: ${profile.focus}` : null,
      "",
      "Prelude AI is the same for all plans. Plan differences are software/roadmap + mentor access only.",
      "Use their name naturally."
    ].filter(Boolean);
    prompt += lines.join("\n");
  }
  return prompt;
}

export async function createChatCompletion(messages, config = {}, profile = null) {
  const apiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY;
  const model = config.openaiModel ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not set");
    error.code = "NOT_CONFIGURED";
    throw error;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    const error = new Error("messages must be a non-empty array");
    error.code = "BAD_REQUEST";
    throw error;
  }

  const systemPrompt = buildSystemPrompt(profile);
  const chatMessages = [{ role: "system", content: systemPrompt }, ...messages];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 600
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`OpenAI request failed (${response.status})`);
    error.code = "UPSTREAM_ERROR";
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    const error = new Error("Empty model response");
    error.code = "EMPTY_RESPONSE";
    throw error;
  }

  return { text, model };
}
