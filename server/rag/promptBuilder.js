import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeConversationHistory } from "./conversationHistory.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const systemPromptPath = path.join(repoRoot, "prelude_dataset_kit/knowledge/PRELUDE_SYSTEM_PROMPT.md");
const knowledgePath = path.join(repoRoot, "prelude_dataset_kit/knowledge/AGENT_KNOWLEDGE.md");
const businessKnowledgePath = path.join(
  repoRoot,
  "prelude_dataset_kit/knowledge/PRELUDE_BUSINESS_KNOWLEDGE.md"
);

function readFileOrEmpty(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

export function loadPreludeInstructions() {
  return {
    system: readFileOrEmpty(systemPromptPath),
    knowledge: readFileOrEmpty(knowledgePath),
    businessKnowledge: readFileOrEmpty(businessKnowledgePath)
  };
}

const RESPONSE_STYLE_RULES = `
Write in polished, readable markdown.

Be direct. Answer the user's actual question before adding context.

Use short paragraphs.

Use bold labels when they improve scanning.

Use bullets for comparisons, steps, or plan features.

Use headings only when the answer is long enough to need them.

Do not produce walls of text.

Do not repeat the same idea.

Do not sound like a scripted sales bot.

Do not introduce yourself repeatedly.

Do not repeat the Prelude mission unless the user asks what Prelude is.

Do not force a mentor referral into every answer.

Do not ask questions the user already answered.

For short follow-ups, use the recent conversation context.

When the user corrects you, acknowledge the correction briefly and answer again.

When comparing options, clearly state the most important distinction first.

Use natural transitions.

Ask at most one useful follow-up question when it helps.

Never invent Prelude pricing, discounts, or website routes.

Only use verified internal links from the route registry when linking to Prelude pages.
`.trim();

function formatRetrievedBlocks(blocks) {
  if (!blocks?.length) {
    return "No structured dataset records were retrieved for this question.";
  }

  return blocks
    .map((block) => {
      const lines = block.records.map((record, index) => `${index + 1}. [${record.source}] ${record.summary}`);
      return `${block.heading}:\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

function conversationModeInstructions(historyLength) {
  if (historyLength > 0) {
    return [
      "This is a continuing conversation.",
      "Do not greet the user again.",
      "Do not reintroduce yourself as Prelude AI.",
      "Answer the current follow-up directly using prior messages for context."
    ].join(" ");
  }

  return "This is the first user message in this chat session. You may use one brief welcome only if it fits naturally.";
}

/** System + user messages for chat models (works with OpenAI and Ollama). */
export function buildRagChatMessages({ message, conversationHistory = [], retrieval, profile = null }) {
  const instructions = loadPreludeInstructions();
  const sanitizedHistory = sanitizeConversationHistory(conversationHistory);

  const systemContent = [
    instructions.system,
    "",
    RESPONSE_STYLE_RULES,
    "",
    "## Curated admissions knowledge",
    instructions.knowledge,
    "",
    "## Prelude business and platform knowledge",
    instructions.businessKnowledge,
    buildProfileAddon(profile),
    "",
    conversationModeInstructions(sanitizedHistory.length)
  ]
    .join("\n")
    .trim();

  const state = retrieval?.conversationState;
  const stateLines = state
    ? [
        "## Known conversation preferences",
        state.state ? `- State: ${state.state}` : null,
        state.intendedMajor ? `- Intended major: ${state.intendedMajor}` : null,
        state.budget != null ? `- Budget target: $${state.budget}` : null,
        state.priority ? `- Priority: ${state.priority}` : null,
        state.schoolsUnderDiscussion?.length
          ? `- Schools under discussion: ${state.schoolsUnderDiscussion.map((school) => school.canonicalName).join(", ")}`
          : null,
        ""
      ].filter(Boolean)
    : [];

  const currentUserContent = [
    ...stateLines,
    "## Retrieved official data",
    formatRetrievedBlocks(retrieval?.blocks),
    "",
    "## Current user question",
    message.trim(),
    "",
    retrieval?.multipleMatches
      ? "Multiple verified high school records matched. Ask the user which school they mean before stating a single address."
      : null,
    retrieval?.blocks?.some((block) =>
      block.records.some((record) => record.type === "notice" && record.id === "no-high-school-match")
    )
      ? "No verified high school record was found. Say you do not have a confirmed local record and recommend the school's official website. Do not guess an address or city."
      : null,
    "",
    "Reply in clean markdown. Answer the question directly. Use verified retrieved data only for specific school facts.",
    "Never respond with only a brief acknowledgement such as Okay, Got it, or Thanks when the user asked a substantive question. Answer the actual question first."
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [{ role: "system", content: systemContent }];

  for (const item of sanitizedHistory) {
    messages.push({ role: item.role, content: item.content });
  }

  messages.push({ role: "user", content: currentUserContent });

  return messages;
}

export function buildRagUserPrompt(args) {
  const messages = buildRagChatMessages(args);
  return messages.at(-1)?.content ?? args.message.trim();
}

function formatProfileValue(value) {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 12);
    return cleaned.length ? cleaned.join(", ") : null;
  }
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

export function buildProfileAddon(profile) {
  if (!profile || typeof profile !== "object") return "";

  const name = formatProfileValue(profile.name);
  const grade = formatProfileValue(profile.grade);
  const intendedMajor = formatProfileValue(profile.intendedMajor ?? profile.major ?? profile.focus);
  const gpa = formatProfileValue(profile.gpa);
  const interests = formatProfileValue(profile.interests);
  const goals = formatProfileValue(profile.goals);
  const role = formatProfileValue(profile.role);
  const plan = formatProfileValue(profile.planName ?? profile.plan);

  const hasUsefulContext = [name, grade, intendedMajor, gpa, interests, goals, role, plan].some(Boolean);
  if (!hasUsefulContext) return "";

  const lines = [
    "",
    "SIGNED-IN MEMBER CONTEXT:",
    name ? `- Name: ${name}` : null,
    plan ? `- Plan: ${plan}` : null,
    role ? `- Role: ${role}` : null,
    grade ? `- Grade: ${grade}` : null,
    intendedMajor ? `- Intended major / focus: ${intendedMajor}` : null,
    gpa ? `- GPA: ${gpa}` : null,
    interests ? `- Interests: ${interests}` : null,
    goals ? `- Goals: ${goals}` : null,
    "",
    "Use this member context to personalize general guidance, but do not treat client-provided profile values as verified official records.",
    "Prelude AI is the same for all plans. Plans differ only in roadmap tools and mentor access."
  ].filter(Boolean);
  return lines.join("\n");
}

export function uniqueSourceLabels(sources) {
  const labels = new Set();
  for (const group of sources ?? []) {
    if (group?.label) labels.add(group.label);
    for (const record of group?.records ?? []) {
      if (record?.source) labels.add(record.source);
    }
  }
  return [...labels];
}
