/**
 * Compose substantive answers from retrieved records when the LLM returns a stub.
 */

import { normalizeMajorTerm } from "../datasets/majorSynonyms.js";

const STUB_ACKNOWLEDGEMENTS =
  /^(okay|ok|got it|sure|thanks|thank you|hi|hello|hey|that|this|yes|no|maybe|thanks)[.!?\s]*$/i;

function collegeLabel(summary) {
  const name = String(summary ?? "").split(" · ")[0]?.trim();
  return name || "this school";
}

function formatCollegeComparison(records, majorHint = "", priority = "") {
  const lines = records.slice(0, 4).map((record) => `- **${collegeLabel(record.summary)}**: ${record.summary ?? ""}`);
  const names = records.map((record) => collegeLabel(record.summary));
  const majorLine = majorHint
    ? `For **${majorHint}**, here is a comparison based on verified College Scorecard data:`
    : "Here is a comparison based on verified College Scorecard data:";

  const focus =
    priority === "cost"
      ? "Focus on average net price and tuition below.\n\n"
      : priority === "program strength"
        ? "Focus on program fit and institutional strengths below — confirm specific major details on each school's site.\n\n"
        : "";

  return `${majorLine}\n\n${lines.join("\n")}\n\n${focus}Both ${names.join(" and ")} can be strong options depending on whether you prioritize specialized computing depth, broader university resources, cost, or campus environment.\n\nWhich matters more to you right now — CS program strength, cost, or campus experience?`.trim();
}

function formatAffordabilityComparison(records) {
  const sorted = [...records].sort((a, b) => {
    const priceA = Number(String(a.summary).match(/avg net price \$(\d+)/)?.[1] ?? Infinity);
    const priceB = Number(String(b.summary).match(/avg net price \$(\d+)/)?.[1] ?? Infinity);
    return priceA - priceB;
  });
  const lines = sorted.map((record) => `- ${record.summary ?? ""}`);
  const cheapest = collegeLabel(sorted[0]?.summary);
  const priciest = collegeLabel(sorted.at(-1)?.summary);

  return `Based on verified College Scorecard average net price data:\n\n${lines.join("\n")}\n\n**${cheapest}** is lower on average net price than **${priciest}** in these records. Confirm current aid and costs on each school's official site.`;
}

function formatCollegeList(records, majorHint = "", budget = null, priority = "") {
  const lines = records.slice(0, 6).map((record, index) => `${index + 1}. ${record.summary ?? ""}`);
  const majorLine = majorHint
    ? `Here are verified Georgia colleges with **${majorHint}** programs`
    : "Here are verified colleges to explore from College Scorecard data";
  const budgetLine =
    budget != null ? ` around your **$${budget.toLocaleString()}** budget target` : "";
  const priorityLine = priority ? `, prioritizing **${priority}**` : "";

  return `${majorLine}${budgetLine}${priorityLine}:\n\n${lines.join("\n")}\n\nIf you want, I can narrow further by campus size or public vs. private.`;
}

export function isLowQualityLlmAnswer(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return true;
  if (trimmed.length < 50) return true;
  if (STUB_ACKNOWLEDGEMENTS.test(trimmed)) return true;
  if (/^[#*_\-.\s]+$/u.test(trimmed)) return true;
  if (/^i(?:'m| am)? prelude ai\b/i.test(trimmed) && trimmed.length < 160) return true;
  if (/^i (?:can|will) help/i.test(trimmed) && trimmed.length < 120) return true;
  return false;
}

export function isOffTopicMessage(message) {
  return /\b(brawl stars|fortnite|minecraft|roblox|video games?|tiktok|instagram)\b/i.test(message);
}

export function buildStaticGuidanceAnswer(message) {
  const lower = message.toLowerCase();

  if (isOffTopicMessage(message)) {
    return "I'm here to help with college planning, applications, financial aid, majors, and choosing schools — not general gaming or entertainment topics.\n\nIf you want, tell me what grade you're in or what part of the college process you're thinking about.";
  }

  if (/\b(don't know where to start|do not know where to start|getting started)\b/.test(lower)) {
    return "No problem — the easiest place to start is by figuring out what matters most to you: possible majors, location, cost, and the type of campus experience you want.\n\nWhat grade are you in right now?";
  }

  if (/\b(best|top|good)\b.{0,30}\b(school|college|universit)/.test(lower)) {
    const major = extractMajorHint(message);
    return `There is no single “best” college for everyone. For ${major ? `**${major}**` : "your interests"}, strong programs, affordability, and admission fit all matter.\n\nShare your state or region and whether you care more about program reputation, net price, or campus size, and I can help you narrow a list.`;
  }

  return null;
}

function extractMajorHint(message) {
  const match = message.match(
    /\b(?:for|in)\s+(cs|computer science|engineering|nursing|business|biology|psychology|data science)\b/i
  );
  if (match) return normalizeMajorTerm(match[1]);
  if (/\bcs\b/i.test(message)) return "computer science";
  return "";
}

export function shouldPreferRetrievalAnswer(intent, retrieval) {
  const records = (retrieval?.blocks ?? []).flatMap((block) => block.records ?? []);
  if (!records.length) return false;

  return (
    intent === "school_comparison" ||
    retrieval.intent === "college_comparison" ||
    intent === "school_search" ||
    intent === "major_program_search" ||
    intent === "affordability"
  );
}

export function buildRetrievalAssistedAnswer(message, retrieval, conversationState = {}) {
  const records = (retrieval?.blocks ?? [])
    .flatMap((block) => block.records ?? [])
    .filter((record) => record.type !== "notice");

  if (!records.length) return null;

  const majorHint =
    normalizeMajorTerm(retrieval.major) ||
    conversationState.intendedMajor ||
    extractMajorHint(message);
  const colleges = records.filter((record) => record.type === "college");
  const isComparison =
    retrieval.intent === "college_comparison" ||
    retrieval.intent === "school_comparison" ||
    (colleges.length >= 2 && /\b(compare|versus|vs\.?|better)\b/i.test(message));

  if (
    (retrieval.intent === "affordability" || /\b(cheaper|more affordable|which is cheaper)\b/i.test(message)) &&
    colleges.length >= 2
  ) {
    const prefix = retrieval.correctionAcknowledgment ? `${retrieval.correctionAcknowledgment}\n\n` : "";
    return prefix + formatAffordabilityComparison(colleges);
  }

  if (isComparison && colleges.length >= 2) {
    const prefix = retrieval.correctionAcknowledgment ? `${retrieval.correctionAcknowledgment}\n\n` : "";
    return (
      prefix +
      formatCollegeComparison(colleges, majorHint, conversationState.priority ?? retrieval.priority ?? "")
    );
  }

  if (isComparison && colleges.length === 1) {
    return `I found verified data for **${collegeLabel(colleges[0].summary)}**, but I could not match a second school from your question. Tell me the other college name and I will compare them.`;
  }

  if (
    (retrieval.intent === "school_search" ||
      retrieval.intent === "major_program_search" ||
      /\b(best|top|good)\b.{0,30}\b(school|college)/i.test(message)) &&
    colleges.length
  ) {
    return formatCollegeList(
      colleges,
      majorHint,
      conversationState.budget,
      conversationState.priority
    );
  }

  const programs = records.filter((record) => record.type === "program");
  if (programs.length && /\b(best|top|school|college|cs|computer science)\b/i.test(message)) {
    const lines = programs.slice(0, 6).map((record, index) => `${index + 1}. ${record.summary ?? ""}`);
    return `For **${majorHint || "this major"}**, here are verified program examples from College Scorecard:\n\n${lines.join("\n")}\n\nI can also list colleges in your state that offer this major if you share your budget.`;
  }

  if (records[0]?.summary) {
    return `Based on verified reference data:\n\n${records
      .slice(0, 5)
      .map((record, index) => `${index + 1}. ${record.summary}`)
      .join("\n")}\n\nWhat should we compare next — cost, programs, or location?`;
  }

  return null;
}

export function buildMandatoryFallbackAnswer(message, conversationState = {}) {
  if (isOffTopicMessage(message)) {
    return buildStaticGuidanceAnswer(message);
  }

  if (conversationState.state && conversationState.intendedMajor) {
    const missing = [];
    if (conversationState.budget == null && /\b(afford|budget|cost|cheap)\b/i.test(message)) {
      missing.push("your target budget");
    }
    if (missing.length) {
      return `I can search verified ${conversationState.state} colleges for **${conversationState.intendedMajor}**. What is ${missing.join(" and ")}?`;
    }
  }

  if (/\b(compare|versus|vs\.?|better)\b/i.test(message)) {
    return "Which two colleges would you like me to compare? Use school names or common abbreviations such as UCLA or GT.";
  }

  return "I want to give you a useful answer rather than a vague reply. Tell me your state, intended major, and whether cost or program strength matters more, and I will help you narrow the next step.";
}
