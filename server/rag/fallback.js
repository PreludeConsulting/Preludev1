import { detectChatIntent, getIntentFallbackText, getMentorReferralDetails, hasRecentEssayContext } from "../../shared/chatIntentRouter.js";

/** Verified site anchors — must match src/lib/preludeChatData.js and Navbar. */
export const FALLBACK_LINKS = {
  plans: "#pricing",
  mentorMatch: "#preludematch",
  mentorship: "#mentorship"
};

export const PLAN_NAMES = ["Basic", "Plus", "Pro"];

const PLAN_SUMMARY =
  "Prelude offers Basic, Plus, and Pro plans. Each plan includes the same Prelude AI assistant, while the amount of mentor access, messaging support, and roadmap guidance varies by plan.";

const PATTERNS = {
  exactChances:
    /\b(exact|specific|precise|actual)\b.*\b(percent|percentage|%|chance|odds|probability)\b|\b(percent|percentage|%)\b.*\b(chance|odds|probability)\b.*\b(get in|admitted|accept)/i,
  fullEssayRewrite:
    /\b(rewrite|write|finish|complete)\b.{0,40}\b(entire|full|whole|complete|my)\b.{0,30}\b(essay|personal statement|common app)\b|\bmake (?:it|my essay) ready to submit\b/i,
  personalizedStrategy:
    /\b(full|complete|entire|custom|personalized)\b.{0,30}\b(roadmap|strategy|college list|application plan|admissions plan)\b|\bbuild (?:my |a )?(?:full |entire )?college list for me\b|\bpersonalized admissions strategy\b/i,
  profileEvaluation:
    /\b(evaluate|review|audit)\b.{0,20}\b(my (?:full )?profile|entire application|complete application)\b|\bdeep (?:profile|application) review\b/i,
  outsideScope:
    /\b(legal advice|immigration lawyer|visa guarantee|investment advice|medical diagnosis|therapy for)\b/i,
  mentorReferral:
    /\b(?:help me|can you|could you|please|i need help)\b.{0,30}\b(?:write|make|create|draft|review|edit)\b.{0,80}\b(?:my )?(?:common app )?(?:essay|personal statement)\b|\b(?:write|make|create|draft|review|edit)\b.{0,50}\b(?:my )?(?:common app )?(?:essay|personal statement)\b|\bhelp me write my essay about\b|\b(?:help me )?(?:create|make|build)\b.{0,30}\b(?:plan for my future|future plan|life plan)\b|\bwhat should i do with my life\b|\b(?:build|create|make|help me build)\b.{0,40}\b(?:college list|school list)\b|\bwhat schools should i apply to\b|\b(?:tell me what major i should|what major should i|which major should i) (?:choose|pick)\b|\b(?:pick|choose) (?:a )?major for me\b|\b(?:make|create|build|help me with)\b.{0,40}\b(?:application strategy|admissions strategy|application plan)\b|\b(?:help me pick|pick|choose|what)\b.{0,40}\bextracurriculars?\b|\bextracurricular strategy\b/i
};

function hasNoVerifiedHighSchoolMatch(retrieval) {
  return retrieval?.blocks?.some((block) =>
    block.records?.some((record) => record.id === "no-high-school-match")
  );
}

function isLocationStyleQuestion(message) {
  return /\b(where is|located|address|location of)\b/i.test(message);
}

function isVagueRequest(message, historyLength) {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length < 4) return true;
  if (historyLength > 0 && trimmed.length < 12) {
    return /^(help|yes|no|ok|okay|sure|maybe|idk|thanks)$/i.test(trimmed);
  }
  if (historyLength === 0 && trimmed.length < 12) {
    return /^(help|hi|hello|hey|yo|sup|idk|what\??)$/i.test(trimmed);
  }
  return false;
}

export function buildFallbackActions(reason) {
  const base = [
    { label: "View Plans", action: "open_plans" },
    { label: "Talk to a Mentor", action: "open_mentor_match" }
  ];

  switch (reason) {
    case "temporary_service_error":
      return [
        { label: "Try Again", action: "try_again" },
        { label: "Talk to a Mentor", action: "open_mentor_match" },
        { label: "View Plans", action: "open_plans" }
      ];
    case "ambiguous_request":
      return [
        { label: "Tell Me More", action: "clarify" },
        { label: "Talk to a Mentor", action: "open_mentor_match" }
      ];
    case "insufficient_verified_information":
      return [
        ...base,
        { label: "Tell Me More", action: "clarify" }
      ];
    case "needs_personalized_guidance":
    case "unsupported_request":
      return base;
    default:
      return [
        ...base,
        { label: "Tell Me More", action: "clarify" }
      ];
  }
}

function buildFallbackPayload(reason, text) {
  return {
    text,
    provider: "prelude",
    model: "fallback",
    fallback: {
      type: "mentor_support",
      reason,
      actions: buildFallbackActions(reason)
    }
  };
}

function buildGuidancePayload(reason, text) {
  return {
    text,
    provider: "prelude",
    model: "guidance",
    fallback: null,
    guidanceReason: reason,
    actions: []
  };
}

function buildMentorReferralPayload(category) {
  const details = getMentorReferralDetails(category);
  return {
    text: details.text,
    provider: "prelude",
    model: "mentor_referral",
    type: "mentor_referral",
    responseType: "mentor_referral",
    category: details.category,
    mentorReferralReason: details.reason,
    ctaLabel: details.ctaLabel,
    ctaTarget: details.ctaTarget,
    fallback: null,
    actions: [
      {
        label: details.ctaLabel,
        href: details.ctaTarget,
        type: "internal"
      }
    ]
  };
}

function buildIntentFallbackPayload(category) {
  return {
    text: getIntentFallbackText(category),
    provider: "prelude",
    model: "intent_fallback",
    type: "intent_fallback",
    responseType: "intent_fallback",
    category,
    fallback: null,
    actions: []
  };
}

function formatKnownContext(conversationState = {}) {
  const parts = [];
  if (conversationState.state) parts.push(`state: **${conversationState.state}**`);
  if (conversationState.intendedMajor) parts.push(`major: **${conversationState.intendedMajor}**`);
  if (conversationState.priority) parts.push(`priority: **${conversationState.priority}**`);
  if (conversationState.budget != null) parts.push(`budget: **$${conversationState.budget.toLocaleString()}**`);
  return parts.length ? ` I’ll keep using your context (${parts.join(", ")}).` : "";
}

function hasEarlyIntentGuidance(message, intent, conversationState = {}) {
  if (
    (intent === "essays" || /\b(essays?|personal statement|common app|supplementals?|supplemental essays?)\b/i.test(message)) &&
    !/\b(what is|how long|how many words|examples?|topic examples?|explain|define)\b/i.test(message)
  ) {
    return buildGuidancePayload(
      "essay_help",
      "Absolutely — I can help with your Common App essay, supplementals, topic ideas, outlines, or editing. Are you starting from scratch or revising a draft?"
    );
  }

  if (intent === "guarantee_refusal") {
    return buildGuidancePayload(
      "admissions_chances",
      `I can’t predict admission outcomes or guarantee a result, but I can help you think about reach/target/likely fit using academics, activities, essays, major, cost, and school selectivity.${formatKnownContext(conversationState)} Which school are you asking about?`
    );
  }

  return null;
}

function hasIntentfulGuidance(message, intent, conversationState = {}) {
  if (intent === "financial_aid" || intent === "affordability") {
    return buildGuidancePayload(
      "cost_financial_aid",
      `I can help with cost and financial aid — net price, in-state vs. out-of-state cost, FAFSA/CSS Profile, scholarships, and lower-cost alternatives.${formatKnownContext(conversationState)} What school or cost question should we look at first?`
    );
  }

  if (intent === "major_program_search") {
    return buildGuidancePayload(
      "major_program_search",
      `I can help find colleges or programs for **${conversationState.intendedMajor || "that major"}** and compare fit, cost, and selectivity.${formatKnownContext(conversationState)} Do you want a school list, program examples, or help comparing two options?`
    );
  }

  return null;
}

const COPY = {
  insufficient_verified_information: `I could not find a verified record for that school, so I do not want to guess. A Prelude mentor can help you confirm the details and figure out the best next step.

${PLAN_SUMMARY}

Would you like to check the available mentor-support plans or clarify which school you mean?`,

  needs_personalized_guidance: `I can share a general starting point, but a strong answer depends on your grades, activities, goals, budget, and school preferences. A Prelude mentor can work with you more closely and help build a plan around your profile.

${PLAN_SUMMARY}

Would you like to explore the plans or answer a few questions so I can point you in the right direction?`,

  exact_chances: `I cannot give an exact admission percentage. Outcomes depend on your academic record, activities, essays, fit, and how competitive the applicant pool is that year. A Prelude mentor can help you review your profile and think through realistic next steps.

${PLAN_SUMMARY}

Would you like to explore mentor-support plans or tell me which schools you are considering?`,

  unsupported_request: `I can give you a general starting point, but a strong answer depends on your grades, activities, goals, budget, and school preferences. A Prelude mentor can work with you more closely and help build a plan around your profile.

${PLAN_SUMMARY}

Would you like to explore the plans or answer a few questions so I can point you in the right direction?`,

  essay_rewrite: `A strong Common App personal statement usually focuses on one meaningful story or value in about 650 words, rather than listing every activity. I can help with structure and brainstorming, but I should not rewrite an entire essay for you.

For detailed feedback and revision, a Prelude mentor is the best next step.

${PLAN_SUMMARY}

Would you like to explore mentor-support plans or tell me which part of the essay you are working on?`,

  ambiguous_request: `I want to make sure I understand what you need before I answer. Could you share a bit more about whether you are asking about college lists, essays, financial aid, majors, deadlines, or something else?

If you would like hands-on help, a Prelude mentor can walk through it with you. ${PLAN_SUMMARY}`,

  generic: `I want to make sure you get an accurate answer rather than a guess. A Prelude mentor can help you work through this in more detail and give you guidance based on your specific situation.

${PLAN_SUMMARY}

Would you like to explore the available plans or tell me a little more about what you are trying to figure out?`,

  temporary_service_error: `I could not complete that request right now. You can try again in a moment, or connect with a Prelude mentor for more personalized help.

${PLAN_SUMMARY}

Would you like to view the available support plans?`
};

function hasActionableContext(conversationState = {}, retrieval = {}, intent = "") {
  if (conversationState.state && conversationState.intendedMajor) return true;
  if ((conversationState.schoolsUnderDiscussion ?? []).length >= 1) return true;
  if (intent === "school_comparison" || retrieval.intent === "college_comparison") return true;
  const records = retrieval?.blocks?.flatMap((block) => block.records ?? []) ?? [];
  return records.some((record) => record.type === "college" || record.type === "program");
}

export function classifyPreLlmFallback({
  message,
  conversationHistory = [],
  retrieval,
  intent,
  conversationState = {}
}) {
  const historyLength = conversationHistory.length;

  if (/\b(brawl stars|fortnite|minecraft|roblox|video games?)\b/i.test(message)) {
    return null;
  }

  if (/\b(i said|i meant|not uga|not ucla|wrong school)\b/i.test(message)) {
    return null;
  }

  if (/\bhelp me write my essay about\b/i.test(message)) {
    return buildMentorReferralPayload("essay");
  }

  if (PATTERNS.fullEssayRewrite.test(message)) {
    return buildFallbackPayload("unsupported_request", COPY.essay_rewrite);
  }

  if (PATTERNS.exactChances.test(message)) {
    return buildFallbackPayload("needs_personalized_guidance", COPY.exact_chances);
  }

  const routedIntent = detectChatIntent(message, { conversationHistory });
  if (routedIntent.type === "mentor_referral" || PATTERNS.mentorReferral.test(message)) {
    const category = routedIntent.category || (/\bessay|personal statement|common app|supplemental\b/i.test(message) ? "essay" : "personal_guidance");
    return buildMentorReferralPayload(category);
  }

  const hasContextForAnswer = hasActionableContext(conversationState, retrieval, intent);
  if (routedIntent.type === "fallback" && !hasContextForAnswer) {
    return buildIntentFallbackPayload(routedIntent.category);
  }

  const earlyIntentGuidance = hasEarlyIntentGuidance(message, intent, conversationState);
  if (earlyIntentGuidance) {
    return earlyIntentGuidance;
  }

  if (hasContextForAnswer) {
    return null;
  }

  const intentGuidance = hasIntentfulGuidance(message, intent, conversationState);
  if (intentGuidance) {
    return intentGuidance;
  }

  if (isVagueRequest(message, historyLength)) {
    const fallbackCategory = hasRecentEssayContext?.(conversationHistory, message) ? "essay_unclear" : "general_unclear";
    return buildIntentFallbackPayload(fallbackCategory);
  }

  if (PATTERNS.outsideScope.test(message)) {
    return buildFallbackPayload("unsupported_request", COPY.generic);
  }

  if (PATTERNS.personalizedStrategy.test(message) || PATTERNS.profileEvaluation.test(message)) {
    return buildFallbackPayload("needs_personalized_guidance", COPY.needs_personalized_guidance);
  }

  if (
    intent === "high_school_search" &&
    hasNoVerifiedHighSchoolMatch(retrieval) &&
    isLocationStyleQuestion(message)
  ) {
    return buildFallbackPayload("insufficient_verified_information", COPY.insufficient_verified_information);
  }

  if (
    intent === "high_school_search" &&
    hasNoVerifiedHighSchoolMatch(retrieval) &&
    /\b(high school|academy|magnet)\b/i.test(message)
  ) {
    return buildFallbackPayload("insufficient_verified_information", COPY.insufficient_verified_information);
  }

  return null;
}

export function classifyPostLlmFallback({ text, retrieval, intent, message = "" }) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return buildFallbackPayload("temporary_service_error", COPY.temporary_service_error);
  }

  if (
    /^(okay|ok|got it|sure|thanks|thank you)[.!?\s]*$/i.test(trimmed) ||
    (trimmed.length < 50 && !/\?/.test(trimmed) && /\b(compare|college|essay|fafsa|major|deadline)\b/i.test(message))
  ) {
    return null;
  }

  if (hasNoVerifiedHighSchoolMatch(retrieval) && intent === "high_school_search") {
    if (
      /\b(i do not have|don't have|no verified|could not find|unable to find)\b/i.test(trimmed) ||
      !/\b(street|address|lane|road|ave|blvd|drive|\d{5})\b/i.test(trimmed)
    ) {
      return buildFallbackPayload("insufficient_verified_information", COPY.insufficient_verified_information);
    }
  }

  const lowConfidenceMarkers = [
    /^hi,?\s+i'?m prelude ai/i,
    /\bas an ai language model\b/i,
    /\bi do not know\b/i,
    /\bi'm not sure\b/i,
    /\bcannot predict\b/i
  ];

  if (
    intent === "high_school_search" &&
    hasNoVerifiedHighSchoolMatch(retrieval) &&
    lowConfidenceMarkers.some((pattern) => pattern.test(trimmed))
  ) {
    return buildFallbackPayload("insufficient_verified_information", COPY.insufficient_verified_information);
  }

  return null;
}

export function buildServiceErrorFallback(error) {
  const code = error?.code ?? "";
  if (code === "NOT_CONFIGURED") return null;

  if (
    code === "OLLAMA_NOT_RUNNING" ||
    code === "OLLAMA_MODEL_NOT_FOUND" ||
    code === "UPSTREAM_ERROR" ||
    code === "EMPTY_RESPONSE" ||
    code === "DATABASE_NOT_FOUND"
  ) {
    return buildFallbackPayload("temporary_service_error", COPY.temporary_service_error);
  }

  return buildFallbackPayload("temporary_service_error", COPY.temporary_service_error);
}
