import { isPreludeBusinessIntent } from "./preludeBusiness.js";

const COLLEGE_CONTEXT = /\b(college|university|institute of technology|georgia tech|uga|ucla|gt|community college)\b/i;
const HIGH_SCHOOL_CONTEXT =
  /\b(high school|magnet school|secondary school|public school|gsmst|gwinnett school of mathematics|my school|current school)\b/i;
const ADMISSIONS_QUESTION =
  /\b(college|university|fafsa|css profile|essay|application|admission|sat|act|major|tuition|scholarship)\b/i;

const INTENT_PATTERNS = [
  {
    intent: "prelude_overview",
    re: /\b(what is prelude|what does prelude do|who is prelude|tell me about prelude|about prelude|prelude consulting)\b/i,
    unless: COLLEGE_CONTEXT
  },
  {
    intent: "plans_comparison",
    re: /\b(difference between|compare|vs\.?|versus)\b.{0,30}\b(basic|plus|pro)\b/i
  },
  {
    intent: "plans_comparison",
    re: /\bwhat(?:'s| is) the difference\b.{0,40}\b(basic|plus|pro|plan)\b/i
  },
  {
    intent: "plan_recommendation",
    re: /\b(which plan|what plan|best plan|should i (?:get|choose)|recommend a plan)\b/i
  },
  {
    intent: "mentor_support",
    re: /\b(message|text|dm|contact)\b.{0,20}\b(mentor|prelude)\b|\bcan i message\b/i
  },
  {
    intent: "mentor_matching",
    re: /\b(find a mentor|match me|preludematch|mentor match|connect with a mentor)\b/i
  },
  {
    intent: "financial_support",
    re: /\b(do you|does prelude|can prelude|will prelude)\b.{0,30}\b(fafsa|css|financial aid|scholarship)\b/i
  },
  {
    intent: "sign_up",
    re: /\b(sign up|signup|register|create an account|create account)\b/i,
    unless: /\b(for|to)\b.{0,20}\b(college|university|school)\b/i
  },
  {
    intent: "sign_in",
    re: /\b(sign in|signin|log in|login)\b/i
  },
  {
    intent: "dashboard_help",
    re: /\b(where is my dashboard|open (?:my )?dashboard|go to (?:my )?dashboard|application dashboard)\b/i
  },
  {
    intent: "consultation",
    re: /\b(book a consultation|schedule a consultation|free consultation|consultation call)\b/i
  },
  {
    intent: "platform_features",
    re: /\b(platform feature|roadmap tool|deadline tracking|essay.?prompt organization|profile analyz|gamified)\b/i
  },
  {
    intent: "website_navigation",
    re: /\b(where (?:do|can) i|how do i)\b.{0,40}\b(on (?:the )?site|website|prelude)\b/i
  },
  {
    intent: "website_navigation",
    re: /\bwhere (?:is|are)\b.{0,30}\b(pricing|plans|mentors?|dashboard|sign up|register)\b/i
  },
  {
    intent: "guarantee_refusal",
    re: /\b(guarantee|guaranteed|100%|surely get in|will i get in|chances of getting in|admission chances)\b/i
  },
  {
    intent: "high_school_search",
    re: /\b(high school|magnet school|secondary school|gsmst|gwinnett school of mathematics)\b/i
  },
  {
    intent: "high_school_search",
    re: /\b(where is|located|address of|location of)\b/i,
    unless: COLLEGE_CONTEXT
  },
  { intent: "school_comparison", re: /\b(compare|versus|vs\.?|better than|which is better)\b.*\b(college|school|university)\b/i },
  {
    intent: "affordability",
    re: /\b(affordable|affordability|cheaper|more affordable|cheap|low cost|net price|tuition|pay for|cost of attendance)\b/i
  },
  { intent: "school_comparison", re: /\bcompare\b.+\b(and|vs\.?|versus)\b/i },
  {
    intent: "school_comparison",
    re: /\b(better|worse|stronger|weaker)\b.{0,40}\b(for|at|in)\b.{0,20}\b(cs|computer science|engineering|major|program)\b/i
  },
  {
    intent: "school_comparison",
    re: /\b(better|vs\.?|versus|compare)\b.{0,40}\b([a-z]{2,6}|ucla|uga|gt|mit|usc)\b/i
  },
  {
    intent: "school_search",
    re: /\b(college|school|university|campus|institution)\b.*\b(in|near|around|located)\b|\b(schools? in|colleges? in|universities in)\b/i
  },
  { intent: "school_search", re: /\b(find|list|recommend|suggest).*\b(college|school|university)\b/i },
  {
    intent: "school_search",
    re: /\b(best|top|good|strongest)\b.{0,40}\b(school|college|universit)/i
  },
  {
    intent: "school_search",
    re: /\b(school|college|universit\w*)\b.{0,30}\b(for|in)\b.{0,25}\b(cs|computer science|engineering|nursing|business|biology)\b/i
  },
  { intent: "major_program_search", re: /\b(major|program|degree|study|field of study|cip)\b/i },
  {
    intent: "career_exploration",
    re: /\b(careers?|jobs|occupations?|o\*?net|work as|professions?)\b/i
  },
  { intent: "essays", re: /\b(essay|personal statement|supplement|common app writing|rewrite my essay)\b/i },
  { intent: "financial_aid", re: /\b(fafsa|css profile|financial aid|scholarship|grant|work-study|efc)\b/i },
  {
    intent: "deadlines_timeline",
    re: /\b(deadline|timeline|early action|early decision|regular decision|rolling admission|when to apply)\b/i
  },
  { intent: "transfer", re: /\b(transfer|community college pathway)\b/i },
  { intent: "international", re: /\b(international student|visa|toefl|ielts|f-1)\b/i },
  { intent: "parent", re: /\b(parent|guardian|my son|my daughter|my kid|help my student)\b/i },
  {
    intent: "getting_started",
    re: /\b(where do i start|getting started|don't know where to start|overwhelm|confused|lost)\b/i
  },
  {
    intent: "general_admissions",
    re: /\b(admission|apply|application|safety|target|reach|test.?optional|sat|act|holistic)\b/i
  }
];

const STATE_NAMES = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY"
};

const AMBIGUOUS_STATE_CODES = new Set(["IN", "OR", "ME", "OK", "HI", "ID", "LA", "MA", "PA", "AS"]);

function isConjunctionStateFalsePositive(code, message) {
  const lower = message.toLowerCase();
  if (code === "OR" && /\bor\b/.test(lower) && !/\boregon\b/.test(lower)) return true;
  if (code === "IN" && /\bin\b/.test(lower) && !/\bindiana\b/.test(lower)) return true;
  if (code === "ME" && /\bme\b/.test(lower) && !/\bmaine\b/.test(lower)) return true;
  return false;
}

export function extractState(message) {
  const upper = message.toUpperCase();
  const codeMatches = [...upper.matchAll(/\b([A-Z]{2})\b/g)].map((match) => match[1]);
  for (const code of codeMatches) {
    if (!Object.values(STATE_NAMES).includes(code)) continue;
    if (isConjunctionStateFalsePositive(code, message)) continue;
    if (AMBIGUOUS_STATE_CODES.has(code) && new RegExp(`\\b(?:DIFFER|MAJOR|JOIN|BEGIN|ENROLL|INTERESTED)\\s+${code}\\b`).test(upper)) {
      continue;
    }
    if (AMBIGUOUS_STATE_CODES.has(code) && !new RegExp(`(?:,|\\s)${code}(?:\\s|$|\\d)`).test(upper)) {
      continue;
    }
    return code;
  }

  const lower = message.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) return code;
  }

  const inState = lower.match(/\b(?:in|around|near)\s+([a-z][a-z\s]{2,24})\b/);
  if (inState) {
    const candidate = inState[1].trim();
    if (STATE_NAMES[candidate]) return STATE_NAMES[candidate];
  }

  return "";
}

export function extractMajorTerms(message) {
  const terms = [];
  const patterns = [
    /\b(?:major(?:ing)? in|study|program in|degree in)\s+([a-z0-9][a-z0-9\s/&-]{2,40})/i,
    /\b(?:for|in)\s+(cs|computer science|engineering|nursing|business|biology|psychology|data science)\b/i,
    /\b(computer science|engineering|nursing|business|biology|psychology|data science)\b/i,
    /\b(cs)\b/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) terms.push(match[1].trim());
    else if (match?.[0]) terms.push(match[0].trim());
  }

  return [...new Set(terms)];
}

export function extractAffordabilityCap(message) {
  const match = message.match(/\b(?:under|below|less than|max(?:imum)?)\s*\$?\s*([\d,]{3,7})\b/i);
  if (match) return Number(match[1].replace(/,/g, ""));

  const compact = message.match(/\b(\d{1,3})\s*k\b/i);
  if (compact) return Number(compact[1]) * 1000;

  const dollars = message.match(/\$\s*([\d,]{3,7})\b/);
  if (dollars) return Number(dollars[1].replace(/,/g, ""));

  return null;
}

export function classifyIntent(message) {
  const text = message.trim();
  if (!text) return { intent: "getting_started", needsRetrieval: false };

  for (const pattern of INTENT_PATTERNS) {
    const { intent, re, unless } = pattern;
    if (!re.test(text)) continue;
    if (unless?.test(text)) continue;

    if (intent === "guarantee_refusal") {
      return { intent, needsRetrieval: false };
    }

    if (intent === "high_school_search" && COLLEGE_CONTEXT.test(text) && !HIGH_SCHOOL_CONTEXT.test(text)) {
      continue;
    }

    return {
      intent,
      needsRetrieval: intentNeedsRetrieval(intent, text)
    };
  }

  if (/\b(prelude|preludematch)\b/i.test(text) && !ADMISSIONS_QUESTION.test(text)) {
    return { intent: "prelude_overview", needsRetrieval: false };
  }

  return { intent: "general_admissions", needsRetrieval: false };
}

export { isPreludeBusinessIntent };

function intentNeedsRetrieval(intent, text) {
  if (isPreludeBusinessIntent(intent)) return false;

  switch (intent) {
    case "high_school_search":
    case "school_search":
    case "school_comparison":
    case "affordability":
    case "major_program_search":
    case "career_exploration":
      return true;
    case "financial_aid":
      return /\b(college|school|university|afford|cost|net price)\b/i.test(text);
    default:
      return false;
  }
}
