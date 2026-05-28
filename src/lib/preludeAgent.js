import { getOpeningMessage, getQuickMenuItems, SYSTEM_PROMPT } from "./agentPrompt.js";
import { formatAnswerFirst, getBroadAnswer } from "./agentKnowledgeBase.js";
import { getPersonalizedOpening, personalizeRuleBasedReply } from "./personalizedAgent.js";
import { MENTORS, SERVICES } from "./preludeChatData.js";

export { SYSTEM_PROMPT };

const QUICK_MENU_ITEMS = getQuickMenuItems();

const PATTERNS = [
  { category: "collegeList", re: /\b(college list|safety|target|reach|which school|where to apply|choosing colleges?|school list)\b/i },
  { category: "essay", re: /\b(essay|personal statement|supplement|common app|application writing|rewrite|edit my essay)\b/i },
  {
    category: "financial",
    re: /\b(fafsa|financial aid|scholarships?|pay for college|tuition|cost|css profile|afford|grant|work-study)\b/i
  },
  { category: "major", re: /\b(major|career|undecided|what to study|choose a field)\b/i },
  {
    category: "timeline",
    re: /\b(deadline|timeline|early action|early decision|regular decision|rolling|when to apply|test.?optional|sat|act)\b/i
  },
  { category: "mentorship", re: /\b(mentor|preludematch|match me|1-on-1|one on one|consultation|book a session)\b/i },
  { category: "transfer", re: /\b(transfer|community college|international student|visa|first.?gen)\b/i },
  { category: "parent", re: /\b(parent|guardian|my son|my daughter|my kid|help my student)\b/i },
  { category: "stress", re: /\b(overwhelm|stressed|confused|anxious|don't know where|lost|help me)\b/i },
  {
    category: "gettingStarted",
    re: /\b(where do i start|don't know where to start|getting started|how do i begin|new to (the )?college|first time applying)\b/i
  }
];

const MENU_MAP = {
  start: "gettingStarted",
  colleges: "collegeList",
  essays: "essay",
  aid: "financial",
  major: "major",
  parent: "parent"
};

function pickMentors(filterFn, count = 4) {
  return MENTORS.filter(filterFn).slice(0, count).length >= 2
    ? MENTORS.filter(filterFn).slice(0, count)
    : MENTORS.slice(0, count);
}

function pickServices(ids) {
  return SERVICES.filter((s) => ids.includes(s.id));
}

function closingQuestion(category) {
  const questions = {
    collegeList: "Do you already have a college list, or are you starting from scratch?",
    essay: "Are you working on your personal statement, supplements, or both?",
    financial: "Is your biggest concern scholarships, FAFSA, or understanding aid packages?",
    major: "Do you have a few majors in mind, or are you completely undecided?",
    timeline: "What grade are you in right now?",
    parent: "What part of the process feels most stressful for your family?",
    mentorship: "Do you already have target schools in mind?",
    transfer: "Are you applying as a transfer, international student, or on another special pathway?",
    stress: "What part of the college process feels most stressful right now?",
    gettingStarted: "Are you looking for help as a student or as a parent?"
  };
  return questions[category] ?? "What grade are you in right now?";
}

export function classify(text) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return "gettingStarted";

  const menuHit = QUICK_MENU_ITEMS.find((item) => normalized === item.label.toLowerCase());
  if (menuHit) return MENU_MAP[menuHit.id] ?? "gettingStarted";

  for (const { category, re } of PATTERNS) {
    if (re.test(text)) return category;
  }

  if (/\b(prelude|what do you do|who are you)\b/i.test(text)) return "about";
  if (/^\s*[1-6]\s*\.?\s*$/.test(normalized)) {
    const idx = parseInt(normalized, 10);
    const keys = ["start", "colleges", "essays", "aid", "major", "parent"];
    return MENU_MAP[keys[idx - 1]] ?? "gettingStarted";
  }

  return "stress";
}

const PRELUDE_NOTES = {
  collegeList:
    "PreludeMatch mentors can help you turn this into a balanced list around your grades, budget, and goals.",
  essay: "Prelude's essay studio is a strong next step for brainstorming and revision tailored to your story.",
  financial:
    "Prelude can help you plan scholarships, FAFSA, and comparing true costs before you apply.",
  major: "A Prelude mentor can help connect your interests to majors and schools that fit.",
  timeline: "Prelude's roadmap support helps map EA, ED, RD, and scholarship deadlines to your grade level.",
  mentorship: "PreludeMatch pairs you with current students from target schools or similar paths.",
  transfer: "Prelude mentors can help with transfer storytelling and requirements — confirm official rules on each college's site.",
  parent: "Prelude gives families clearer visibility on deadlines and progress while keeping the student's voice central.",
  gettingStarted: "Prelude helps you build clarity first, then personalize with a mentor.",
  stress: null,
  about: null
};

const CAROUSEL_BY_CATEGORY = {
  collegeList: {
    type: "mentors",
    title: "Mentors who can help with college lists",
    count: 4,
    items: () => pickMentors((m) => /list|fit|Business/i.test(m.focus + m.major))
  },
  essay: {
    type: "mentors",
    title: "Mentors for essay & application support",
    count: 4,
    items: () => pickMentors((m) => /essay|statement|supplement|Media/i.test(m.focus + m.major))
  },
  financial: {
    type: "services",
    title: "Financial & planning resources",
    count: 3,
    items: () => pickServices(["s4", "s5", "s1"])
  },
  major: {
    type: "mentors",
    title: "Mentors across majors & paths",
    count: 4,
    items: () => MENTORS.slice(0, 4)
  },
  timeline: {
    type: "services",
    title: "Timeline & roadmap support",
    count: 3,
    items: () => pickServices(["s5", "s1", "s3"])
  },
  mentorship: {
    type: "mentors",
    title: "Sample mentor matches",
    count: 6,
    items: () => MENTORS
  },
  transfer: {
    type: "services",
    title: "Pathway support",
    count: 3,
    items: () => pickServices(["s1", "s2", "s5"])
  },
  parent: {
    type: "services",
    title: "Support for families",
    count: 3,
    items: () => pickServices(["s4", "s5", "s1"])
  }
};

function buildCarousel(category) {
  const spec = CAROUSEL_BY_CATEGORY[category];
  if (!spec) return undefined;
  return { ...spec, items: spec.items() };
}

function buildResponse(category, userText) {
  const wantsDetail =
    /\b(full|complete|rewrite|write for me|guarantee|chances|percent|list of schools|roadmap|plan for me)\b/i.test(
      userText
    );

  if (category === "about") {
    return {
      text: formatAnswerFirst({
        broad: getBroadAnswer("about", userText),
        preludeNote: "I can help you figure out which kind of support fits best.",
        closingQuestion: "What are you most worried about right now?"
      }),
      quickReplies: QUICK_MENU_ITEMS
    };
  }

  if (category === "stress" && !/\?/.test(userText)) {
    return {
      text: `${getBroadAnswer("stress", userText)}\n\nWhich one sounds closest to what you need?`,
      quickReplies: QUICK_MENU_ITEMS
    };
  }

  const broad = getBroadAnswer(category, userText);
  let preludeNote = PRELUDE_NOTES[category] ?? PRELUDE_NOTES.gettingStarted;

  if (wantsDetail) {
    preludeNote = `Here's the general idea above — for a plan tailored to your profile, ${preludeNote ?? "a Prelude mentor can go deeper."}`;
  }

  const text = formatAnswerFirst({
    broad,
    preludeNote,
    closingQuestion: closingQuestion(category)
  });

  return {
    text,
    carousel: buildCarousel(category)
  };
}

export function createInitialMessages(profile = null) {
  return [
    {
      id: "welcome",
      role: "assistant",
      text: profile ? getPersonalizedOpening(profile) : getOpeningMessage(),
      createdAt: Date.now()
    }
  ];
}

/** Rule-based replies — answer-first using agentKnowledgeBase; LLM uses AGENT.md + AGENT_KNOWLEDGE.md via /api/chat. */
export function getRuleBasedReply(userText, _history = [], profile = null) {
  const category = classify(userText);
  const payload = buildResponse(category, userText);

  return personalizeRuleBasedReply(
    {
      id: `a-${Date.now()}`,
      role: "assistant",
      createdAt: Date.now(),
      category,
      ...payload
    },
    profile
  );
}

function toChatMessages(history) {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.text }));
}

async function getLLMReply(userText, history, profile = null) {
  const prior = toChatMessages(history);
  const last = prior[prior.length - 1];
  const messages =
    last?.role === "user" && last.content === userText
      ? prior
      : [...prior, { role: "user", content: userText }];

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, profile })
  });

  if (response.status === 503) {
    const error = new Error("Chat API not configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Chat API failed (${response.status})`);
  }

  const data = await response.json();
  const text = data.text?.trim();
  if (!text) throw new Error("Empty model response");

  const category = classify(userText);
  const enrichment = buildResponse(category, userText);

  return personalizeRuleBasedReply(
    {
      id: `a-${Date.now()}`,
      role: "assistant",
      createdAt: Date.now(),
      text,
      source: "llm",
      category,
      carousel: enrichment.carousel,
      quickReplies: enrichment.quickReplies
    },
    profile
  );
}

export async function getAgentReply(userText, history = [], profile = null) {
  try {
    return await getLLMReply(userText, history, profile);
  } catch (error) {
    if (import.meta.env.DEV && error.code !== "NOT_CONFIGURED") {
      console.warn("[Prelude AI] Falling back to rule-based replies:", error.message);
    }
    return getRuleBasedReply(userText, history, profile);
  }
}

export function getTypingDelay(text) {
  return Math.min(1400, 400 + text.length * 8);
}
