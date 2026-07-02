import {
  ADMISSIONS_INTENT_CATEGORIES,
  INTENT_RULES,
  KNOWLEDGE_SOURCE_MAP,
  PROFILE_REQUIREMENTS
} from "./admissionsIntents.js";
import { normalizeForIntentDetection } from "./inputNormalize.js";
import { extractEntities } from "./entityExtraction.js";
import { deriveConversationMemory } from "./conversationMemory.js";
import { detectSchoolTopic } from "./schoolConversation.js";

function matchIntent(text) {
  const matches = [];
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matches.push(rule);
    }
  }
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0] ?? null;
}

function inferSubIntent(category, text, entities) {
  if (category === ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT) {
    return detectSchoolTopic(text);
  }
  if (category === ADMISSIONS_INTENT_CATEGORIES.SAT_ACT) {
    if (/\bretake\b/i.test(text)) return "retake_decision";
    if (/\btest optional\b/i.test(text)) return "test_optional";
    if (/\bact\b/i.test(text)) return "act_interpretation";
    return "sat_interpretation";
  }
  if (category === ADMISSIONS_INTENT_CATEGORIES.ESSAYS) {
    if (/\bwhy us\b/i.test(text)) return "why_us";
    if (/\boutline\b/i.test(text)) return "outline";
    if (/\breview\b/i.test(text)) return "review";
    return "brainstorm";
  }
  if (category === ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH) {
    if (/\b(reach|target|safety)\b/i.test(text)) return "balanced_list";
    if (entities.state) return "location_search";
    if (entities.majors?.length) return "major_search";
    return "general_list";
  }
  return null;
}

function profileHas(field, profile, entities, memory) {
  switch (field) {
    case "gpa":
      return profile?.gpa != null || entities.gpa != null || memory.gpa != null;
    case "sat_or_act":
      return (
        profile?.sat != null ||
        profile?.act != null ||
        entities.sat != null ||
        entities.act != null ||
        memory.sat != null ||
        memory.act != null
      );
    case "major":
      return (profile?.majors?.length ?? 0) > 0 || (entities.majors?.length ?? 0) > 0;
    case "location_or_budget":
      return Boolean(profile?.location || entities.state || profile?.budget || entities.budget || memory.budget);
    case "grade_level":
      return Boolean(profile?.grade || profile?.graduationYear || memory.gradeLevel);
    case "interests":
      return (entities.interests?.length ?? 0) > 0 || (memory.interests?.length ?? 0) > 0;
    case "interests_or_major":
      return profileHas("major", profile, entities, memory) || profileHas("interests", profile, entities, memory);
    case "skill_level":
      return /\b(beginner|intermediate|advanced)\b/i.test(String(profile?.skillLevel ?? ""));
    case "essay_stage":
      return /\b(draft|brainstorm|topic|supplement)\b/i.test(JSON.stringify(profile ?? {}));
    default:
      return true;
  }
}

function shouldAskFollowUp(category, missingFields, entities, profile, memory) {
  if (category === ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT) return false;
  if (!missingFields.length) return false;

  if (category === ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH) {
    const hasSignal =
      profileHas("gpa", profile, entities, memory) ||
      profileHas("sat_or_act", profile, entities, memory) ||
      profileHas("major", profile, entities, memory) ||
      profileHas("location_or_budget", profile, entities, memory);
    return !hasSignal;
  }

  if (category === ADMISSIONS_INTENT_CATEGORIES.SCHOLARSHIPS) {
    return !profileHas("interests", profile, entities, memory) && !profileHas("grade_level", profile, entities, memory);
  }

  if (category === ADMISSIONS_INTENT_CATEGORIES.SUMMER_PROGRAMS) {
    return !profileHas("interests", profile, entities, memory) && !profileHas("grade_level", profile, entities, memory);
  }

  if (category === ADMISSIONS_INTENT_CATEGORIES.SAT_ACT) {
    if (entities.school) return false;
    return !profileHas("sat_or_act", profile, entities, memory);
  }

  if (category === ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS) {
    return !profileHas("gpa", profile, entities, memory) && !profileHas("sat_or_act", profile, entities, memory);
  }

  return missingFields.length > 0;
}

function buildFollowUpQuestions(category, missingFields) {
  const prompts = {
    gpa: "What is your current GPA?",
    sat_or_act: "What are your SAT or ACT scores (if you have them)?",
    major: "What major or field are you most interested in?",
    location_or_budget: "Do you have a preferred state/region or budget range?",
    grade_level: "What grade are you in right now?",
    interests: "What subjects or activities interest you most?",
    interests_or_major: "What major or interests should I use to tailor recommendations?",
    skill_level: "Would you describe your CS skill level as beginner, intermediate, or advanced?",
    essay_stage: "Are you brainstorming, outlining, or revising a draft?"
  };

  return missingFields.slice(0, 3).map((field) => prompts[field]).filter(Boolean);
}

function isSchoolSpecificQuestion(text, entities) {
  if (!entities.school) return false;
  return /\b(average sat|sat average|admission rate|acceptance rate|tuition|how much|cost|get into|need.{0,24}sat|what sat|sat for|what about act)\b/i.test(
    text
  );
}

function isCompetitivenessQuestion(text, entities) {
  if (!entities.school) return false;
  return /\b(can i get|will i get|my chances|do i have a shot|competitive for|good enough for|profile good enough)\b/i.test(text);
}

export function classifyAdmissionsIntent(message, { conversationHistory = [], profile = null, priorState = {} } = {}) {
  const { text } = normalizeForIntentDetection(message);
  const memory = deriveConversationMemory(message, conversationHistory, profile, priorState);
  const entities = extractEntities(text, memory);

  let matched = matchIntent(text);

  if (isCompetitivenessQuestion(text, entities)) {
    matched = { category: ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS, priority: 9 };
  } else if (isSchoolSpecificQuestion(text, entities)) {
    matched = { category: ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT, priority: 9 };
  } else if (!matched && entities.school && /\b(sat|act|admission|acceptance|tuition|cost)\b/i.test(text)) {
    matched = { category: ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT, priority: 7 };
  } else if (!matched && /\b(get into|need.{0,20}sat)\b/i.test(text) && entities.school) {
    matched = { category: ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS, priority: 7 };
  }

  const intentCategory = matched?.category ?? ADMISSIONS_INTENT_CATEGORIES.GENERAL;
  const subIntent = inferSubIntent(intentCategory, text, entities);
  const knowledgeSources = KNOWLEDGE_SOURCE_MAP[intentCategory] ?? [];

  const required = PROFILE_REQUIREMENTS[intentCategory] ?? [];
  const missingProfileFields = required.filter((field) => !profileHas(field, profile, entities, memory));
  const needsFollowUp = shouldAskFollowUp(intentCategory, missingProfileFields, entities, profile, memory);

  return {
    intentCategory,
    subIntent,
    entities,
    memory,
    knowledgeSources,
    requiredProfileFields: required,
    missingProfileFields,
    needsFollowUp,
    followUpQuestions: needsFollowUp ? buildFollowUpQuestions(intentCategory, missingProfileFields) : [],
    confidence: matched ? "high" : "medium"
  };
}
