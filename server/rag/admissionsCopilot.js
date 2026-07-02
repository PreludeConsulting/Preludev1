import { ADMISSIONS_INTENT_CATEGORIES } from "./admissionsIntents.js";
import { classifyAdmissionsIntent } from "./admissionsIntentRouter.js";
import { normalizeForIntentDetection } from "./inputNormalize.js";
import { updateMemoryFromClassification } from "./conversationMemory.js";
import { tryBuildSchoolAnswer } from "./handlers/schoolHandler.js";
import { buildKnowledgeRetrieval } from "./knowledgeRetrieval.js";
import { describeEntityMatch } from "./entityExtraction.js";
import {
  formatCollegeList,
  formatGuidanceAnswer,
  formatKnowledgeRecords
} from "./answerTemplates.js";

const GUIDANCE_SNIPPETS = {
  [ADMISSIONS_INTENT_CATEGORIES.ESSAYS]: {
    title: "Here’s how I can help with essays:",
    bullets: [
      "Start with one specific story, value, or moment — not a résumé list.",
      "Use concrete details: what happened, what you did, what changed.",
      "For supplements, answer the exact prompt and show fit with that school.",
      "I can help brainstorm, outline, or revise — paste a draft or topic idea."
    ],
    footer: "I won’t invent personal experiences for you. Authenticity matters more than sounding impressive."
  },
  [ADMISSIONS_INTENT_CATEGORIES.APPLICATION_STRATEGY]: {
    title: "Application strategy basics:",
    bullets: [
      "Early Decision is usually binding; Early Action is usually non-binding — confirm each school.",
      "A balanced list often includes reach, target, and likely schools you would actually attend.",
      "Seniors: finalize school list, request recommendations, and draft core essays first.",
      "Juniors: build your list, plan tests, and deepen 1–2 meaningful activities."
    ],
    footer: "Exact deadlines vary by school — verify on each admissions site and in the Common App."
  },
  [ADMISSIONS_INTENT_CATEGORIES.FINANCIAL_AID]: {
    title: "Financial aid starting points:",
    bullets: [
      "FAFSA is the main federal aid form; many private colleges also use the CSS Profile.",
      "Compare **net price** after grants/scholarships, not just sticker tuition.",
      "Merit aid and need-based aid follow different rules — check each school.",
      "Use each college’s net price calculator for a rough estimate."
    ],
    footer: "I can’t guarantee aid packages. Verify requirements on StudentAid.gov and each college’s financial aid page."
  },
  [ADMISSIONS_INTENT_CATEGORIES.GPA_ACADEMICS]: {
    title: "Academic planning guidance:",
    bullets: [
      "Colleges care about course rigor in context — AP/IB/honors where it makes sense for you.",
      "Aim for strong performance in courses related to your intended major when possible.",
      "One B in a hard class is not automatically fatal; trend and rigor matter.",
      "If you’re overloaded, protect grades in core subjects before adding more APs."
    ],
    footer: "Share your grade level, current courses, and target schools for a more tailored plan."
  },
  [ADMISSIONS_INTENT_CATEGORIES.PARENT]: {
    title: "How parents can help without adding pressure:",
    bullets: [
      "Help with organization: deadlines, accounts, document gathering.",
      "Discuss budget and financial aid early so the list stays realistic.",
      "Encourage the student’s voice in essays and interviews.",
      "Consider Prelude mentors for extra structure and accountability."
    ],
    footer: "The student should own the application narrative; parents support the process."
  },
  [ADMISSIONS_INTENT_CATEGORIES.PLANNING]: {
    title: "A simple next-step plan:",
    bullets: [
      "Pick one priority: school list, testing, activities, essays, or scholarships.",
      "Block 2–3 hours this week for that priority only.",
      "Write down missing profile info (GPA, tests, major interests, budget).",
      "Come back with one specific question and we’ll go deeper."
    ],
    footer: "Tell me your grade level and biggest worry and I’ll narrow this further."
  },
  [ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_EDUCATION]: {
    title: "Quick definitions:",
    bullets: [
      "**Holistic admissions** reviews academics, activities, essays, recommendations, and context together.",
      "**Safety school**: your profile is stronger than typical admits (not a guarantee).",
      "**Test optional**: many schools don’t require scores, but strong scores can still help at some colleges.",
      "**Demonstrated interest** can matter at some schools through visits, emails, or applying early."
    ],
    footer: "Policies vary by college and year — confirm on official admissions pages."
  },
  [ADMISSIONS_INTENT_CATEGORIES.MENTOR_MATCH]: {
    title: "Prelude mentor support:",
    bullets: [
      "PreludeMatch connects you with mentors from target schools or similar paths.",
      "Mentors can help with essays, college lists, timelines, and application strategy.",
      "Tell me your goals, major, and support type (essay help, list building, etc.)."
    ],
    footer: "Visit PreludeMatch on the site to start matching."
  },
  [ADMISSIONS_INTENT_CATEGORIES.WAITLIST_DEFERRAL]: {
    title: "If you were deferred or waitlisted:",
    bullets: [
      "Send a brief, positive Letter of Continued Interest only if the school welcomes updates.",
      "Share meaningful new achievements — grades, awards, projects — not repeated old info.",
      "Keep working on applications for schools where you are still an active applicant.",
      "Commit to another strong option by deposit deadlines so you have a great backup plan."
    ],
    footer: "Policies vary by school — confirm update instructions on the admissions portal."
  },
  [ADMISSIONS_INTENT_CATEGORIES.ACTIVITIES_LIST]: {
    title: "Strong activity descriptions:",
    bullets: [
      "Lead with an action verb and your role (founded, led, organized, built).",
      "Add scope: hours per week, people impacted, funds raised, or measurable outcomes.",
      "Prioritize depth and consistency over a long list of shallow clubs.",
      "Order by impact and time commitment, not alphabetically."
    ],
    footer: "Paste an activity description if you want line-by-line feedback."
  },
  [ADMISSIONS_INTENT_CATEGORIES.COMMON_APP_HELP]: {
    title: "Common App basics:",
    bullets: [
      "Activities: up to 10 entries with concise descriptions and hours/week.",
      "Honors: academic awards and recognitions with grade level and level of recognition.",
      "FERPA waiver: many counselors prefer you waive so recommendations stay confidential.",
      "Additional information: use for context (schedule limits, disruptions), not a second essay."
    ],
    footer: "Always double-check the latest Common App and school-specific instructions."
  }
};

function buildFollowUpAnswer(classification) {
  const questions = classification.followUpQuestions;
  if (!questions.length) return null;

  return {
    text: `To give you a useful answer, I need a little more context:\n\n${questions.map((q) => `- ${q}`).join("\n")}`,
    provider: "prelude",
    model: "slot_filling",
    intent: classification.intentCategory,
    conversationState: updateMemoryFromClassification(classification.memory, classification),
    retrievedRecords: [],
    sourceLabels: []
  };
}

function recordsFromRetrieval(retrieval) {
  return retrieval.blocks.flatMap((block) => block.records).slice(0, 8);
}

function shouldTrySchoolAnswer(intent, entities, text) {
  if (entities.school && isSchoolSpecificQuestion(text, entities)) return true;
  if (entities.school && isCompetitivenessQuestion(text, entities)) return true;
  return (
    intent === ADMISSIONS_INTENT_CATEGORIES.SCHOOL_FACT ||
    intent === ADMISSIONS_INTENT_CATEGORIES.ADMISSIONS_COMPETITIVENESS
  );
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

export async function buildAdmissionsCopilotAnswer({
  message,
  conversationHistory = [],
  profile = null,
  priorState = {}
}) {
  const { text: normalizedText } = normalizeForIntentDetection(message);
  const classification = classifyAdmissionsIntent(normalizedText, {
    conversationHistory,
    profile,
    priorState
  });

  const memory = updateMemoryFromClassification(classification.memory, classification);
  const intent = classification.intentCategory;

  if (shouldTrySchoolAnswer(intent, classification.entities, normalizedText)) {
    const schoolAnswer = tryBuildSchoolAnswer({
      message: normalizedText,
      conversationHistory,
      profile,
      priorState: memory
    });
    if (schoolAnswer) {
      const prefix = describeEntityMatch(classification.entities.school);
      return {
        ...schoolAnswer,
        text: prefix ? `${prefix}\n\n${schoolAnswer.text}` : schoolAnswer.text,
        conversationState: { ...memory, ...(schoolAnswer.conversationState ?? {}) }
      };
    }
  }

  if (classification.needsFollowUp && !classification.entities.school) {
    const followUp = buildFollowUpAnswer(classification);
    if (followUp) return followUp;
  }

  if (intent === ADMISSIONS_INTENT_CATEGORIES.COLLEGE_SEARCH) {
    const list = formatCollegeList({
      profile,
      entities: classification.entities,
      limit: 6
    });
    return {
      text: list.text,
      provider: "prelude",
      model: "college_list",
      intent,
      retrievedRecords: list.retrievedRecords,
      sourceLabels: list.sourceLabels,
      conversationState: memory
    };
  }

  const databaseIntents = new Set([
    ADMISSIONS_INTENT_CATEGORIES.SCHOLARSHIPS,
    ADMISSIONS_INTENT_CATEGORIES.SUMMER_PROGRAMS,
    ADMISSIONS_INTENT_CATEGORIES.EXTRACURRICULARS,
    ADMISSIONS_INTENT_CATEGORIES.CS_PROJECTS,
    ADMISSIONS_INTENT_CATEGORIES.SAT_ACT,
    ADMISSIONS_INTENT_CATEGORIES.SCHOOL_COMPARISON,
    ADMISSIONS_INTENT_CATEGORIES.COLLEGE_CHOICE
  ]);

  if (databaseIntents.has(intent)) {
    const retrieval = await buildKnowledgeRetrieval(normalizedText, {
      limit: 8,
      profile,
      sourceTypes: classification.knowledgeSources
    });
    const records = recordsFromRetrieval(retrieval);
    if (records.length) {
      const formatted = formatKnowledgeRecords(
        "Here are matches from the Prelude database:",
        records,
        "Verify deadlines, eligibility, and costs on official sites before applying."
      );
      return {
        text: formatted.text,
        provider: "prelude",
        model: "retrieval",
        intent,
        retrievedRecords: formatted.retrievedRecords,
        sourceLabels: formatted.sourceLabels,
        conversationState: memory
      };
    }
  }

  const guidance = GUIDANCE_SNIPPETS[intent];
  if (guidance) {
    const formatted = formatGuidanceAnswer(guidance);
    return {
      text: formatted.text,
      provider: "prelude",
      model: "guidance",
      intent,
      retrievedRecords: formatted.retrievedRecords,
      sourceLabels: formatted.sourceLabels,
      conversationState: memory
    };
  }

  return null;
}

export { classifyAdmissionsIntent };
