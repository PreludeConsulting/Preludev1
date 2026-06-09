const ESSAY_CONTEXT_RE = /\b(essay|essays|personal statement|common app|supplemental|supplementals|draft|topic)\b/i;
const ESSAY_MULTICHOICE_RE = /starting from scratch or revising a draft/i;
const SIMPLE_ESSAY_INFO_RE = /\b(what is|how long|how many words|examples?|topic examples?|explain|define)\b/i;
const ESSAY_MENTOR_RE =
  /\b(help me with essays?|essay help|personal statement help|i need help with supplementals?|supplemental help)\b|\b(help me|can you|could you|please|i need help)\b.{0,35}\b(write|make|create|draft|review|revise|edit)\b.{0,80}\b(my )?(common app )?(essay|personal statement|supplemental)\b|\b(write|make|create|draft|review|revise|edit)\b.{0,55}\b(my )?(common app )?(essay|personal statement|supplemental)\b/i;
const COLLEGE_LIST_RE =
  /\b(what|which|where)\b.{0,30}\b(colleges?|schools?|universities)\b.{0,25}\b(apply|choose|pick)\b|\b(build|create|make|help me build|narrow)\b.{0,35}\b(college list|school list|options)\b|\b(college list|school list)\b|\b(choosing colleges?|compare schools?|compare colleges?|narrow(?:ing)? (?:my )?options)\b/i;
const FINANCIAL_RE = /\b(scholarships?|fafsa|css profile|financial aid|\baid\b|tuition|afford|affordable|costs?|money|pay for college)\b/i;
const MENTOR_GUIDANCE_RE =
  /\b(help me )?(create|make|build)\b.{0,35}\b(plan for my future|future plan|life plan)\b|\bwhat should i do with my life\b|\b(tell me what major i should|what major should i|which major should i) (choose|pick)\b|\b(pick|choose) (a )?major for me\b|\b(make|create|build|help me with)\b.{0,45}\b(application strategy|admissions strategy|application plan)\b|\b(help me pick|pick|choose|what)\b.{0,45}\bextracurriculars?\b|\bextracurricular strategy\b|\b(deep|personal|personalized)\b.{0,30}\b(guidance|planning|plan|strategy)\b/i;
const APPLICATION_STRATEGY_RE = /\b(application strategy|admissions strategy|application plan)\b/i;
const EXTRACURRICULAR_RE = /\b(extracurricular|activity|activities)\b/i;
const MAJOR_FUTURE_RE = /\b(major|life|future|career)\b/i;
const LOW_INFORMATION_RE = /^[a-z0-9?!.\s]{1,16}$/i;
const KNOWN_SHORT_RE = /\b(hi|hello|hey|help|yes|no|ok|okay|thanks|thank you|scratch|draft|revising|starting|idk)\b/i;

const FALLBACK_TEXT = {
  general_unclear:
    "Sorry, I didn’t fully understand that. Are you asking about essays, college lists, financial aid, applications, scholarships, or mentor support?",
  essay_unclear:
    "Do you want help starting an essay, revising a draft, choosing a topic, or getting matched with a mentor?",
  college_list:
    "I want to give you a useful answer rather than a vague reply. Tell me your state, intended major, and whether cost or program strength matters more, and I’ll help you narrow the next step.",
  financial_aid:
    "Are you looking for scholarships, financial aid guidance, FAFSA help, or ways to compare college costs?",
  mentor:
    "This sounds like something a student mentor could help with directly. Do you want me to match you with a mentor?"
};

const ESSAY_MENTOR_TEXT =
  "Essay support is one of the best places to work with a Prelude mentor. A mentor can help you choose a strong topic, structure your story, and revise your draft with real feedback. You can start with one of our mentor plans to get essay help.";

function messageText(item) {
  return String(item?.content ?? item?.text ?? "").trim();
}

export function getRecentMessages(history = [], limit = 8) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item?.role === "user" || item?.role === "assistant")
    .slice(-limit)
    .map((item) => ({ role: item.role, content: messageText(item) }))
    .filter((item) => item.content.length > 0);
}

export function getLastAssistantMessage(history = []) {
  return [...getRecentMessages(history)].reverse().find((item) => item.role === "assistant") ?? null;
}

export function hasRecentEssayContext(history = [], message = "") {
  const lastAssistant = getLastAssistantMessage(history);
  return ESSAY_CONTEXT_RE.test(message) || ESSAY_CONTEXT_RE.test(lastAssistant?.content ?? "") || ESSAY_MULTICHOICE_RE.test(lastAssistant?.content ?? "");
}

function isLowInformationMessage(message) {
  const trimmed = String(message ?? "").trim();
  if (!trimmed) return true;
  if (trimmed.length <= 3) return true;
  if (/^[^a-z0-9]+$/i.test(trimmed)) return true;
  if (LOW_INFORMATION_RE.test(trimmed) && !KNOWN_SHORT_RE.test(trimmed) && trimmed.split(/\s+/).length <= 2) {
    return true;
  }
  return false;
}

export function detectChatIntent(message, { conversationHistory = [] } = {}) {
  const text = String(message ?? "").trim();
  const essayContext = hasRecentEssayContext(conversationHistory, text);

  if (ESSAY_MENTOR_RE.test(text) && !SIMPLE_ESSAY_INFO_RE.test(text)) {
    return { type: "mentor_referral", category: "essay" };
  }

  if (MENTOR_GUIDANCE_RE.test(text)) {
    const category = EXTRACURRICULAR_RE.test(text)
      ? "extracurricular"
      : MAJOR_FUTURE_RE.test(text)
        ? "future_planning"
        : APPLICATION_STRATEGY_RE.test(text)
          ? "application_strategy"
          : "personal_guidance";
    return { type: "mentor_referral", category };
  }

  if (COLLEGE_LIST_RE.test(text)) {
    return { type: "fallback", category: "college_list" };
  }

  if (FINANCIAL_RE.test(text) && /\b(i need|need|help|looking for|find|get|where can i get)\b/i.test(text) && !/\b(what is|explain|how do|when|start looking|difference)\b/i.test(text)) {
    return { type: "fallback", category: "financial_aid" };
  }

  if (FINANCIAL_RE.test(text)) {
    return { type: "normal", category: "financial" };
  }

  if (essayContext && isLowInformationMessage(text)) {
    return { type: "fallback", category: "essay_unclear" };
  }

  if (isLowInformationMessage(text)) {
    return { type: "fallback", category: "general_unclear" };
  }

  return { type: "normal", category: "general" };
}

export function getIntentFallbackText(category) {
  return FALLBACK_TEXT[category] ?? FALLBACK_TEXT.general_unclear;
}

export function getMentorReferralDetails(category = "personal_guidance") {
  if (category === "essay") {
    return {
      category: "essay",
      reason: "essay_guidance",
      ctaLabel: "View mentor plans",
      ctaTarget: "#pricing",
      text: ESSAY_MENTOR_TEXT
    };
  }

  return {
    category,
    reason: category,
    ctaLabel: "Match me with a mentor",
    ctaTarget: "#preludematch",
    text: FALLBACK_TEXT.mentor
  };
}
