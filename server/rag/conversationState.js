import { normalizeMajorTerm } from "../datasets/majorSynonyms.js";
import { resolveCollegesFromText } from "../datasets/collegeAliases.js";
import { extractAffordabilityCap, extractMajorTerms, extractState } from "./intent.js";

const PRIORITY_PATTERNS = [
  { key: "program strength", re: /\b(program strength|strong(?:er)? programs?|academic strength|best programs?)\b/i },
  { key: "cost", re: /\b(cost|cheaper|afford|budget|tuition|net price|financial)\b/i },
  { key: "campus environment", re: /\b(campus (?:life|environment|culture|experience)|social life)\b/i }
];

function parseBudgetFromText(message) {
  const explicit = extractAffordabilityCap(message);
  if (explicit != null) return explicit;

  const compact = message.match(/\b(\d{1,3})\s*k\b/i);
  if (compact) return Number(compact[1]) * 1000;

  const dollars = message.match(/\$\s*([\d,]{3,7})\b/);
  if (dollars) return Number(dollars[1].replace(/,/g, ""));

  const bare = message.match(/\b(\d{4,6})\b/);
  if (bare && Number(bare[1]) >= 1000) return Number(bare[1]);

  return null;
}

function mergeField(previous, next) {
  if (next != null && next !== "") return next;
  return previous ?? null;
}

export function deriveConversationState(message, conversationHistory = []) {
  const state = {
    userType: null,
    state: null,
    budget: null,
    intendedMajor: null,
    priority: null,
    schoolsUnderDiscussion: [],
    lastIntent: null,
    lastRetrievedSources: []
  };

  const transcripts = [
    ...(Array.isArray(conversationHistory) ? conversationHistory : []),
    { role: "user", content: message }
  ];

  for (const item of transcripts) {
    const text = String(item?.content ?? item?.text ?? "").trim();
    if (!text) continue;

    const role = item.role ?? "user";
    if (role === "user") {
      state.state = mergeField(state.state, extractState(text) || null);
      const majors = extractMajorTerms(text);
      if (majors.length) {
        state.intendedMajor = normalizeMajorTerm(majors[0]);
      } else if (/\bcs\b/i.test(text)) {
        state.intendedMajor = "computer science";
      }

      const budget = parseBudgetFromText(text);
      if (budget != null) state.budget = budget;

      for (const { key, re } of PRIORITY_PATTERNS) {
        if (re.test(text)) state.priority = key;
      }

      const schools = resolveCollegesFromText(text);
      if (schools.length) {
        const merged = new Map(state.schoolsUnderDiscussion.map((school) => [school.unitid, school]));
        for (const school of schools) {
          merged.set(school.unitid, school);
        }
        state.schoolsUnderDiscussion = [...merged.values()];
      }
    }
  }

  return state;
}

export function hasSufficientSearchContext(state) {
  return Boolean(state.state || state.intendedMajor || state.budget != null || state.schoolsUnderDiscussion.length);
}
