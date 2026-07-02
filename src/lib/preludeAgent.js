import { detectChatIntent, getIntentFallbackText, getMentorReferralDetails } from "../../shared/chatIntentRouter.js";
import { mapFallbackActionsToQuickReplies } from "./chatFallbackActions.js";
import { sanitizeClientActions } from "./chatLinkSecurity.js";
import { getOpeningMessage, getQuickMenuItems, SYSTEM_PROMPT } from "./agentPrompt.js";
import { formatAnswerFirst, getBroadAnswer } from "./agentKnowledgeBase.js";
import { getPersonalizedOpening, personalizeRuleBasedReply } from "./personalizedAgent.js";
import { MENTORS, SERVICES } from "./preludeChatData.js";

export { SYSTEM_PROMPT };

const QUICK_MENU_ITEMS = getQuickMenuItems();

const PATTERNS = [
  {
    category: "collegeComparison",
    re: /\b(compare|versus|vs\.?|better)\b.{0,40}\b(college|school|university|tech|uga|gt)\b|\b(gt|georgia tech)\b.{0,30}\b(uga|georgia)\b/i
  },
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
  {
    category: "gettingStarted",
    re: /\b(where do i start|don't know where to start|getting started|how do i begin|new to (the )?college|first time applying)\b/i
  },
  { category: "stress", re: /\b(overwhelm|stressed|confused|anxious|lost)\b/i }
];

const MENU_MAP = {
  start: "gettingStarted",
  colleges: "collegeList",
  essays: "essay",
  aid: "financial",
  major: "major",
  parent: "parent"
};

function buildMentorReferralReply(category) {
  const details = getMentorReferralDetails(category);
  return {
    category: details.category,
    text: details.text,
    type: "mentor_referral",
    responseType: "mentor_referral",
    mentorReferralReason: details.reason,
    ctaLabel: details.ctaLabel,
    ctaTarget: details.ctaTarget,
    actions: [
      {
        label: details.ctaLabel,
        href: details.ctaTarget,
        type: "internal"
      }
    ]
  };
}

function buildIntentFallbackReply(category) {
  return {
    category,
    text: getIntentFallbackText(category),
    type: "intent_fallback",
    responseType: "intent_fallback"
  };
}

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

  return "collegeList";
}

function normalizeFlowText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRecentConversationMessages(history = []) {
  return history
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? message.text ?? "").trim()
    }))
    .filter((message) => message.content.length > 0);
}

function getLastAssistantMessage(history = []) {
  return [...getRecentConversationMessages(history)].reverse().find((message) => message.role === "assistant") ?? null;
}

function wasAskedForEssayDraftStatus(history = []) {
  const lastAssistant = getLastAssistantMessage(history);
  return /starting from scratch or revising a draft/i.test(lastAssistant?.content ?? "");
}

function isClearlyNewTopicReply(reply) {
  return /\b(colleges?|schools?|major|career|fafsa|financial aid|scholarships?|tuition|cost|deadline|sat|act|mentor|parent|transfer)\b/i.test(
    reply
  );
}

function buildEssayDraftStatusReply(userText, history = []) {
  if (!wasAskedForEssayDraftStatus(history)) return null;

  const reply = normalizeFlowText(userText);
  if (!reply || reply.split(" ").filter(Boolean).length > 8 || isClearlyNewTopicReply(reply)) return null;

  if (/^(scratch|from scratch|starting from scratch|start from scratch|start|new|new essay|brainstorm|i haven'?t started|haven'?t started|not started|i have not started)$/.test(reply)) {
    return {
      category: "essay",
      text:
        "Great — let’s start from scratch. First, we’ll find a strong topic. What’s one experience, challenge, interest, family responsibility, community, or part of your life that feels important to who you are?"
    };
  }

  if (/^(draft|a draft|revising|revision|revise|editing|edit|i have a draft|have a draft|i already have a draft|already have a draft)$/.test(reply)) {
    return {
      category: "essay",
      text:
        "Perfect — since you’re revising a draft, paste the draft or a paragraph you want help with. I can help with structure, clarity, voice, and whether the story is showing the right qualities without rewriting it for you."
    };
  }

  if (/^(yes|yeah|yep|sure|ok|okay)$/.test(reply)) {
    return {
      category: "essay",
      text:
        "Great — are you **starting from scratch** or **revising a draft**? Reply with `scratch` or `draft`, and I’ll take the right next step."
    };
  }

  if (/^(no|nope|not sure|idk|i don'?t know)$/.test(reply)) {
    return {
      category: "essay",
      text:
        "No problem — we can start with brainstorming. What is one activity, responsibility, challenge, community, or interest that has shaped how you think or act? Even a rough idea is enough."
    };
  }

  return null;
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

  if (category === "stress" && !/\?/.test(userText) && /\b(help me|don't know|confused|overwhelm|lost)\b/i.test(userText)) {
    return {
      text: `${getBroadAnswer("stress", userText)}\n\nWhich one sounds closest to what you need?`,
      quickReplies: QUICK_MENU_ITEMS
    };
  }

  if (category === "collegeComparison") {
    const broad =
      "Comparisons depend on the specific schools, major, and what you prioritize — program depth, cost, admission selectivity, or campus fit. Name the colleges you want compared (for example UCLA and Georgia Tech for CS) and I can use verified College Scorecard data.";
    return {
      text: formatAnswerFirst({
        broad,
        preludeNote: PRELUDE_NOTES.collegeList,
        closingQuestion: "Which two schools should I compare, and what major matters most?"
      })
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
      isWelcome: true,
      showInitialQuickActions: true,
      text: profile ? getPersonalizedOpening(profile) : getOpeningMessage(),
      quickReplies: getQuickMenuItems(),
      createdAt: Date.now()
    }
  ];
}

/** Rule-based replies — answer-first using agentKnowledgeBase; LLM uses AGENT.md + AGENT_KNOWLEDGE.md via /api/chat. */
export function getRuleBasedReply(userText, history = [], profile = null) {
  const flowReply = buildEssayDraftStatusReply(userText, history);
  const routedIntent = flowReply ? { type: "normal" } : detectChatIntent(userText, { conversationHistory: history });
  const routedReply =
    routedIntent.type === "mentor_referral"
      ? buildMentorReferralReply(routedIntent.category)
      : routedIntent.type === "fallback"
        ? buildIntentFallbackReply(routedIntent.category)
        : null;
  const category = flowReply?.category ?? routedReply?.category ?? classify(userText);
  const payload = flowReply ?? routedReply ?? buildResponse(category, userText);

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

const MAX_CONVERSATION_HISTORY = 12;

function toConversationHistory(history) {
  const priorHistory = history.at(-1)?.role === "user" ? history.slice(0, -1) : history;

  return priorHistory
    .filter((m) => (m.role === "user" || m.role === "assistant") && !m.isWelcome && !m.isError)
    .slice(-MAX_CONVERSATION_HISTORY)
    .map((m) => ({ role: m.role, content: m.text ?? m.content }));
}

async function getLLMReply(userText, history, profile = null) {
  const conversationHistory = toConversationHistory(history);

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userText, conversationHistory, profile })
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 503 && data.error === "not_configured") {
    const error = new Error("Chat API not configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data.message ?? `Chat API failed (${response.status})`);
    error.code = data.error ?? "CHAT_API_ERROR";
    throw error;
  }

  const text = (data.answer ?? data.text)?.trim();
  if (!text) throw new Error("Empty model response");

  const category = classify(userText);
  const fallbackQuickReplies = data.fallback
    ? mapFallbackActionsToQuickReplies(data.fallback)
    : [];

  const actions = sanitizeClientActions(data.actions);

  return personalizeRuleBasedReply(
    {
      id: `a-${Date.now()}`,
      role: "assistant",
      createdAt: Date.now(),
      text,
      source: data.fallback ? "fallback" : data.model === "business" ? "business" : "llm",
      category,
      sources: Array.isArray(data.sources) ? data.sources : [],
      retrievedRecords: Array.isArray(data.retrievedRecords) ? data.retrievedRecords : [],
      actions: actions.length ? actions : undefined,
      fallback: data.fallback ?? null,
      type: data.type ?? data.responseType ?? null,
      responseType: data.responseType ?? data.type ?? null,
      mentorReferralReason: data.mentorReferralReason ?? null,
      ctaLabel: data.ctaLabel ?? null,
      ctaTarget: data.ctaTarget ?? null,
      quickReplies: fallbackQuickReplies.length ? fallbackQuickReplies : undefined
    },
    profile
  );
}

export function getChatErrorReply(error) {
  if (error.code === "not_configured" || error.code === "NOT_CONFIGURED") {
    return null;
  }

  const message =
    error.code === "database_not_found"
      ? "Prelude's college and career reference data is not available right now. You can still ask general admissions questions, or try again after the datasets are set up."
      : error.code === "ollama_not_running"
        ? "Prelude AI could not reach Ollama. Start it with \"ollama serve\", then try again."
        : error.code === "ollama_model_not_found"
          ? "The local Ollama model is not installed yet. Run \"ollama pull gemma3\", then try again."
          : "Prelude AI could not respond right now. Please check your connection and try again in a moment.";

  return {
    id: `err-${Date.now()}`,
    role: "assistant",
    createdAt: Date.now(),
    text: message,
    isError: true
  };
}

export async function getAgentReply(userText, history = [], profile = null) {
  try {
    return await getLLMReply(userText, history, profile);
  } catch (error) {
    const errorReply = getChatErrorReply(error);
    if (errorReply) return errorReply;

    if (import.meta.env.DEV && error.code !== "NOT_CONFIGURED") {
      console.warn("[Prelude AI] Falling back to rule-based replies:", error.message);
    }
    return getRuleBasedReply(userText, history, profile);
  }
}

export function getTypingDelay(text) {
  return Math.min(1400, 400 + text.length * 8);
}
