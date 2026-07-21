import { sanitizeConversationHistory } from "./conversationHistory.js";
import { deriveConversationState } from "./conversationState.js";
import { deriveActiveConversationState } from "./flowState.js";
import { isGuaranteeRequest } from "./guaranteeIntent.js";
import {
  classifySchoolQuestionIntent,
  deriveSchoolConversationContext,
  detectSchoolTopic
} from "./schoolConversation.js";
import { lookupUniversitiesInText } from "./universityLookup.js";

export const CHAT_DISPATCH_ROUTES = Object.freeze({
  SAFETY: "safety",
  CONVERSATION_FOLLOW_UP: "conversation_follow_up",
  SCHOOL_SPECIFIC: "school_specific",
  STRUCTURED_ADMISSIONS: "structured_admissions",
  RECOMMENDATION_OR_COMPARISON: "recommendation_or_comparison",
  GENERAL: "general"
});

const STRUCTURED_FINANCIAL_RE =
  /\b(cost|tuition|net price|budget|fees?|afford|affordability|cheaper|financial aid|pay for)\b/i;
const OVERVIEW_RE =
  /\b(tell me (?:a bit )?(?:more )?about|more about|what do you know about|info(?:rmation)? on|want to go to|interested in attending)\b/i;
const RECOMMENDATION_RE =
  /\b(best|top|good|recommend|suggest|which schools?|what colleges?|college list|school list)\b/i;
const COMPARISON_RE = /\b(compare|comparison|versus|vs\.?|better|worse|stronger)\b/i;
const CORRECTION_RE = /\b(i said|not\s+.+\s+(?:but|,)|i meant|rather than)\b/i;

function isSupportedSchoolFact(message) {
  const intent = classifySchoolQuestionIntent(message);
  const topic = detectSchoolTopic(message);
  return intent === "school_fact" && !["overview", "cost"].includes(topic);
}

/**
 * Pure routing core. It consumes only precomputed primitive facts, making route
 * precedence deterministic and independent of datasets, files, and lazy caches.
 */
export function dispatchGuardedChatFacts(facts = {}) {
  if (facts.safety) return CHAT_DISPATCH_ROUTES.SAFETY;
  if (facts.activeEssayFollowUp) return CHAT_DISPATCH_ROUTES.CONVERSATION_FOLLOW_UP;
  if (facts.structuredFinancial) return CHAT_DISPATCH_ROUTES.STRUCTURED_ADMISSIONS;

  if (facts.comparisonOrCorrection) {
    return CHAT_DISPATCH_ROUTES.RECOMMENDATION_OR_COMPARISON;
  }

  if (facts.explicitHighConfidenceSchoolCount === 1 && facts.supportedSchoolFact) {
    return CHAT_DISPATCH_ROUTES.SCHOOL_SPECIFIC;
  }
  if (facts.persistedSchoolFollowUp && facts.supportedSchoolFact) {
    return CHAT_DISPATCH_ROUTES.CONVERSATION_FOLLOW_UP;
  }
  if (facts.needsSchoolClarification && facts.supportedSchoolFact) {
    return CHAT_DISPATCH_ROUTES.SCHOOL_SPECIFIC;
  }

  if (facts.structuredOverview || facts.structuredSearchContext) {
    return CHAT_DISPATCH_ROUTES.STRUCTURED_ADMISSIONS;
  }
  if (facts.recommendation || facts.comparisonContext) {
    return CHAT_DISPATCH_ROUTES.RECOMMENDATION_OR_COMPARISON;
  }
  return CHAT_DISPATCH_ROUTES.GENERAL;
}

/**
 * Resolve dataset-backed and conversational signals outside the pure dispatcher.
 */
export function buildGuardedChatFacts({ message, conversationHistory = [], priorState = {} }) {
  const text = String(message ?? "").trim();
  const history = sanitizeConversationHistory(conversationHistory);
  const activeFlow = deriveActiveConversationState(text, history);
  const currentSchools = lookupUniversitiesInText(text).filter(
    (school) => school.matchConfidence === "high"
  );
  const conversationState = deriveConversationState(text, history);
  const schoolContext = deriveSchoolConversationContext(text, history, priorState);
  const hasComparisonContext =
    currentSchools.length > 1 ||
    (conversationState.schoolsUnderDiscussion?.length ?? 0) > 1;

  return {
    safety: isGuaranteeRequest(text),
    activeEssayFollowUp: activeFlow.mode === "essay_help" && Boolean(activeFlow.stage),
    structuredFinancial: STRUCTURED_FINANCIAL_RE.test(text),
    comparisonOrCorrection:
      currentSchools.length > 1 || COMPARISON_RE.test(text) || CORRECTION_RE.test(text),
    explicitHighConfidenceSchoolCount: currentSchools.length,
    supportedSchoolFact: isSupportedSchoolFact(text),
    persistedSchoolFollowUp:
      currentSchools.length === 0 && schoolContext.continuedFromPrior && Boolean(schoolContext.school),
    needsSchoolClarification: schoolContext.needsSchoolClarification,
    structuredOverview: currentSchools.length > 0 || OVERVIEW_RE.test(text),
    structuredSearchContext: Boolean(
      conversationState.state && conversationState.intendedMajor && conversationState.budget != null
    ),
    recommendation: RECOMMENDATION_RE.test(text),
    comparisonContext: hasComparisonContext
  };
}

export function dispatchGuardedChatRoute(input) {
  return dispatchGuardedChatFacts(buildGuardedChatFacts(input));
}
