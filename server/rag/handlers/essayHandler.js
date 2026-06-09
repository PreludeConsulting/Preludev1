function normalizeReply(message) {
  return String(message ?? "")
    .toLowerCase()
    .replace(/[.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isShortReply(text) {
  return text.split(" ").filter(Boolean).length <= 8;
}

function isClearlyNewTopicReply(reply) {
  return /\b(colleges?|schools?|major|career|fafsa|financial aid|scholarships?|tuition|cost|deadline|sat|act|mentor|parent|transfer)\b/i.test(
    reply
  );
}

function buildResponse(text, stage) {
  return {
    text,
    intent: "essays",
    provider: "prelude",
    model: "flow",
    activeFlow: {
      mode: "essay_help",
      stage
    }
  };
}

export function handleEssayFlow({ message, flowState }) {
  if (flowState.mode !== "essay_help") return null;

  const reply = normalizeReply(message);
  if (!reply || !isShortReply(reply) || isClearlyNewTopicReply(reply)) return null;

  if (flowState.stage === "awaiting_draft_status") {
    if (/^(scratch|from scratch|starting from scratch|start from scratch|start|new|new essay|brainstorm|i haven'?t started|haven'?t started|not started|i have not started)$/.test(reply)) {
      return buildResponse(
        "Great — let’s start from scratch. First, we’ll find a strong topic. What’s one experience, challenge, interest, family responsibility, community, or part of your life that feels important to who you are?",
        "topic_discovery"
      );
    }

    if (/^(draft|a draft|revising|revision|revise|editing|edit|i have a draft|have a draft|i already have a draft|already have a draft)$/.test(reply)) {
      return buildResponse(
        "Perfect — since you’re revising a draft, paste the draft or a paragraph you want help with. I can help with structure, clarity, voice, and whether the story is showing the right qualities without rewriting it for you.",
        "awaiting_draft"
      );
    }

    if (/^(yes|yeah|yep|sure|ok|okay)$/.test(reply)) {
      return buildResponse(
        "Great — are you **starting from scratch** or **revising a draft**? Reply with `scratch` or `draft`, and I’ll take the right next step.",
        "awaiting_draft_status"
      );
    }

    if (/^(no|nope|not sure|idk|i don'?t know)$/.test(reply)) {
      return buildResponse(
        "No problem — we can start with brainstorming. What is one activity, responsibility, challenge, community, or interest that has shaped how you think or act? Even a rough idea is enough.",
        "topic_discovery"
      );
    }
  }

  return null;
}
