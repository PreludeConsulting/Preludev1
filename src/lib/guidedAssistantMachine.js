export const MAIN_MENU_STATE = "main_menu";

const FIND_MENTOR_ACTION = { type: "navigate", href: "#preludematch" };
const externalResourceAction = (href) => ({ type: "external", href });

const RESOURCE_URLS = {
  fafsa: "https://studentaid.gov/h/apply-for-aid/fafsa",
  scholarships: "https://bigfuture.collegeboard.org/scholarship-search",
  aidOffers: "https://studentaid.gov/articles/evaluating-financial-aid-offers/",
  collegeSearch: "https://collegescorecard.ed.gov/",
  admissions: "https://www.commonapp.org/explore/",
  careers: "https://www.bls.gov/ooh/"
};

export const GUIDED_ASSISTANT_STATES = {
  main_menu: {
    message: "Hi, I’m Prelude Guide. What would you like help with today?",
    choices: [
      { id: "find_mentor", label: "Find a Mentor", action: FIND_MENTOR_ACTION },
      { id: "essays", label: "Essays", target: "essay_start" },
      { id: "colleges", label: "College List Help", target: "college_start" },
      { id: "aid", label: "Financial Aid & Scholarships", target: "aid_start" },
      { id: "deadlines", label: "Application Deadlines", target: "deadline_start" },
      { id: "major", label: "Major & Career Exploration", target: "major_start" },
      { id: "parents", label: "Parent Support", target: "parent_start" }
    ]
  },
  essay_start: {
    message: "Essays are personal, so the best help usually comes from a real mentor who can understand your story. Where are you in the process?",
    choices: [
      { id: "essay_brainstorm", label: "I need a topic", target: "essay_brainstorm" },
      { id: "essay_outline", label: "I have an outline", target: "essay_outline" },
      { id: "essay_draft", label: "I have a draft", target: "essay_draft" },
      { id: "essay_supplemental", label: "I need supplemental essay help", target: "essay_supplemental" },
      { id: "essay_mentor", label: "Find an essay mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  essay_brainstorm: {
    message: "A mentor can get to know your experiences and help you identify a topic that feels personal and authentic to you.",
    choices: [{ id: "essay_mentor", label: "Choose a topic with a mentor", action: FIND_MENTOR_ACTION }]
  },
  essay_outline: {
    message: "A mentor can review your outline in the context of your story and help you see whether it represents you clearly.",
    choices: [{ id: "essay_mentor", label: "Review my outline with a mentor", action: FIND_MENTOR_ACTION }]
  },
  essay_draft: {
    message: "A mentor can give personal feedback on your draft while helping you preserve your own voice and story.",
    choices: [{ id: "essay_mentor", label: "Review my draft with a mentor", action: FIND_MENTOR_ACTION }]
  },
  essay_supplemental: {
    message: "Supplemental essays depend heavily on the school, prompt, and your fit. A mentor can help you connect your experiences to each college without sounding generic.",
    choices: [{ id: "essay_mentor", label: "Work on supplementals with a mentor", action: FIND_MENTOR_ACTION }]
  },
  college_start: {
    message: "What matters most as you build your college list?",
    choices: [
      { id: "college_fit", label: "Academic and campus fit", target: "college_fit" },
      { id: "college_cost", label: "Affordability", target: "college_cost" },
      { id: "college_balance", label: "Safety, target, and reach", target: "college_balance" }
    ]
  },
  college_fit: {
    message: "Compare schools by major strength, learning environment, location, size, and support. Keep only factors that would materially change your decision.",
    choices: [
      { id: "college_resource", label: "Research colleges", action: externalResourceAction(RESOURCE_URLS.collegeSearch) },
      { id: "college_mentor", label: "Build my list with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  college_cost: {
    message: "Compare estimated net price, not sticker price. Include grants, likely merit aid, travel, housing, and whether costs could change after the first year.",
    choices: [
      { id: "college_cost_resource", label: "Compare college costs", action: externalResourceAction(RESOURCE_URLS.collegeSearch) },
      { id: "aid_next", label: "Explore financial aid", target: "aid_start" },
      { id: "college_cost_mentor", label: "Compare costs with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  college_balance: {
    message: "Build a balanced list with likely, target, and reach options. Every school should be one you would attend and can reasonably afford; admission is never guaranteed.",
    choices: [
      { id: "college_resource", label: "Research colleges", action: externalResourceAction(RESOURCE_URLS.collegeSearch) },
      { id: "college_mentor", label: "Review my list with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  aid_start: {
    message: "Which financial-aid topic do you need?",
    choices: [
      { id: "fafsa", label: "FAFSA", target: "aid_fafsa" },
      { id: "scholarships", label: "Scholarships", target: "aid_scholarships" },
      { id: "offers", label: "Compare aid offers", target: "aid_offers" }
    ]
  },
  aid_fafsa: {
    message: "FAFSA is the federal financial aid application used by most U.S. colleges.",
    choices: [
      { id: "fafsa_resource", label: "Open FAFSA Website", action: externalResourceAction(RESOURCE_URLS.fafsa) },
      { id: "aid_mentor", label: "Get help from a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  aid_scholarships: {
    message: "Scholarship opportunities vary by college, organization, employer, and community.",
    choices: [
      { id: "scholarship_resource", label: "Scholarship Search Resources", action: externalResourceAction(RESOURCE_URLS.scholarships) },
      { id: "aid_mentor", label: "Create a scholarship plan with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  aid_offers: {
    message: "Compare grants, loans, work-study, annual cost, and renewal requirements.",
    choices: [
      { id: "aid_offers_resource", label: "Learn about comparing aid offers", action: externalResourceAction(RESOURCE_URLS.aidOffers) },
      { id: "aid_mentor", label: "Review offers with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  deadline_start: {
    message: "Choose the deadline area you want to organize.",
    choices: [
      { id: "deadline_rounds", label: "EA, ED, and RD", target: "deadline_rounds" },
      { id: "deadline_plan", label: "Build a timeline", target: "deadline_plan" }
    ]
  },
  deadline_rounds: {
    message: "Early Decision is generally binding; Early Action is generally non-binding; Regular Decision follows the standard timeline. Verify every policy and date on the college’s official admissions site.",
    choices: [
      { id: "deadline_resource", label: "Visit college admissions website", action: externalResourceAction(RESOURCE_URLS.admissions) },
      { id: "deadline_mentor", label: "Build a timeline with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  deadline_plan: {
    message: "Always verify deadlines directly with the college.",
    choices: [
      { id: "deadline_resource", label: "Visit college admissions website", action: externalResourceAction(RESOURCE_URLS.admissions) },
      { id: "deadline_mentor", label: "Build a timeline with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  major_start: {
    message: "How clear are you about your intended major?",
    choices: [
      { id: "major_explore", label: "I’m undecided", target: "major_explore" },
      { id: "major_compare", label: "I’m comparing a few", target: "major_compare" }
    ]
  },
  major_explore: {
    message: "Research majors, coursework, careers, and outcomes before making a decision.",
    choices: [
      { id: "career_resource", label: "Explore careers", action: externalResourceAction(RESOURCE_URLS.careers) },
      { id: "major_mentor", label: "Explore with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  major_compare: {
    message: "Research majors, coursework, careers, and outcomes before making a decision.",
    choices: [
      { id: "career_resource", label: "Explore careers", action: externalResourceAction(RESOURCE_URLS.careers) },
      { id: "major_mentor", label: "Compare paths with a mentor", action: FIND_MENTOR_ACTION }
    ]
  },
  parent_start: {
    message: "Parents can help most by organizing deadlines and financial conversations while keeping the student’s voice central in essays and decisions.",
    choices: [
      { id: "parent_timeline", label: "Help with organization", target: "deadline_plan" },
      { id: "parent_cost", label: "Discuss affordability", target: "college_cost" },
      { id: "parent_mentor", label: "Find student support", action: FIND_MENTOR_ACTION }
    ]
  }
};

const ROUTES = [
  { state: "essay_start", terms: ["essay", "esssay", "personal statement", "common app", "supplement", "writing"] },
  { state: "college_start", terms: ["college", "collge", "school", "list", "reach", "target", "safety"] },
  { state: "aid_start", terms: ["fafsa", "financial aid", "scholarship", "scholorship", "tuition", "cost", "money"] },
  { state: "deadline_start", terms: ["deadline", "timeline", "early action", "early decision", "regular decision"] },
  { state: "major_start", terms: ["major", "career", "undecided", "study"] },
  { state: "parent_start", terms: ["parent", "guardian", "son", "daughter", "student"] }
];

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return rows[a.length][b.length];
}

export function routeGuidedAssistantText(input) {
  const text = normalize(input);
  if (!text) return MAIN_MENU_STATE;
  const words = text.split(" ");

  for (const route of ROUTES) {
    if (route.terms.some((term) => text.includes(term))) return route.state;
  }

  for (const route of ROUTES) {
    if (route.terms.some((term) => !term.includes(" ") && words.some((word) => word.length >= 4 && editDistance(word, term) <= 1))) {
      return route.state;
    }
  }

  return MAIN_MENU_STATE;
}

export function createGuidedAssistantSnapshot() {
  return { state: MAIN_MENU_STATE, history: [], fallback: false };
}

export function getGuidedAssistantView(snapshot) {
  const state = GUIDED_ASSISTANT_STATES[snapshot.state] ?? GUIDED_ASSISTANT_STATES[MAIN_MENU_STATE];
  return { ...state, id: snapshot.state, fallback: Boolean(snapshot.fallback) };
}

export function transitionGuidedAssistant(snapshot, event) {
  const current = GUIDED_ASSISTANT_STATES[snapshot.state] ? snapshot : createGuidedAssistantSnapshot();

  if (event.type === "MAIN_MENU") return createGuidedAssistantSnapshot();
  if (event.type === "FIND_MENTOR") return { ...current, action: FIND_MENTOR_ACTION };
  if (event.type === "BACK") {
    if (!current.history.length) return current;
    return { state: current.history.at(-1), history: current.history.slice(0, -1), fallback: false };
  }
  if (event.type === "TEXT") {
    const target = routeGuidedAssistantText(event.value);
    return {
      state: target,
      history: target === current.state ? current.history : [...current.history, current.state],
      fallback: target === MAIN_MENU_STATE
    };
  }
  if (event.type === "CHOOSE") {
    const choice = GUIDED_ASSISTANT_STATES[current.state]?.choices?.find((item) => item.id === event.choiceId);
    if (!choice) return current;
    if (choice.action) return { ...current, action: choice.action };
    return { state: choice.target, history: [...current.history, current.state], fallback: false };
  }
  return current;
}
