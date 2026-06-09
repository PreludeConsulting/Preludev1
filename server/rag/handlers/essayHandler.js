function normalizeReply(message) {
  return String(message ?? "")
    .toLowerCase()
    .replace(/[.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isShortReply(text) {
  return text.split(" ").filter(Boolean).length <= 6;
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
  if (!reply || !isShortReply(reply)) return null;

  if (flowState.stage === "awaiting_draft_status") {
    if (/^(scratch|from scratch|starting from scratch|start from scratch|start|new|brainstorm)$/.test(reply)) {
      return buildResponse(
        "Great — we’ll start from scratch. Let’s do topic discovery first: tell me **one experience, challenge, interest, family responsibility, community, or personal value** that feels important to you. If you’re not sure, send me 2–3 rough ideas and I’ll help you choose the strongest one.",
        "topic_discovery"
      );
    }

    if (/^(draft|a draft|revising|revision|revise|editing|edit|i have a draft|have a draft)$/.test(reply)) {
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
