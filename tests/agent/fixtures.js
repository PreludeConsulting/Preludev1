/**
 * Training & regression cases — run with `npm test` or `npm run train:agent`.
 * Add cases here when users report weak answers; grounded in AGENT_KNOWLEDGE.md.
 */

export const TRAINING_CASES = [
  {
    id: "fafsa-what-is",
    userMessage: "What is FAFSA and when do I fill it out?",
    category: "financial",
    mustMatch: [/fafsa|free application for federal student aid/i, /october|studentaid|federal/i],
    minWords: 35
  },
  {
    id: "college-list-basics",
    userMessage: "What's the difference between safety, target, and reach schools?",
    category: "collegeList",
    mustMatch: [/safety|likely/i, /target|match/i, /reach/i],
    minWords: 30
  },
  {
    id: "early-action-decision",
    userMessage: "What's the difference between Early Action and Early Decision?",
    category: "timeline",
    mustMatch: [/early action/i, /early decision/i, /binding|non-binding/i],
    minWords: 25
  },
  {
    id: "essay-length",
    userMessage: "How long should my Common App personal statement be?",
    category: "essay",
    mustMatch: [/650|word/i, /personal statement|common app/i],
    minWords: 20
  },
  {
    id: "undecided-major",
    userMessage: "I'm undecided on my major — can I still apply to college?",
    category: "major",
    mustMatch: [/undecided|explore|don't need|not required/i],
    minWords: 25
  },
  {
    id: "test-optional",
    userMessage: "Do I need to submit SAT scores if schools are test optional?",
    category: "timeline",
    mustMatch: [/test.?optional|each school|policy|varies/i],
    minWords: 20
  },
  {
    id: "scholarship-start",
    userMessage: "How do I start looking for scholarships?",
    category: "financial",
    mustMatch: [/scholarship|merit|fafsa|college|deadline/i],
    minWords: 25
  },
  {
    id: "parent-role",
    userMessage: "I'm a parent — how can I help without taking over my kid's application?",
    category: "parent",
    mustMatch: [/parent|family|student|voice|deadline|organiz/i],
    minWords: 25
  },
  {
    id: "transfer-basics",
    userMessage: "How does transfer admissions work?",
    category: "transfer",
    mustMatch: [/transfer|credit|college|varies|each school/i],
    minWords: 20
  },
  {
    id: "direct-question-no-deflect",
    userMessage: "Explain what CSS Profile is",
    category: "financial",
    mustMatch: [/css profile|institutional|aid|college board/i],
    mustNotBeDeflectionOnly: true,
    minWords: 20
    // p
  }
];
