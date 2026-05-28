import { getOpeningMessage } from "./agentPrompt.js";
import { getPlan } from "./plans.js";
import { PRELUDE_AI_NAME, PRELUDE_AI_RESPONSIBILITIES } from "./preludeAi.js";

export function buildProfileContext(profile) {
  if (!profile) return "";

  const plan = getPlan(profile.plan);
  return [
    "## Signed-in Prelude member",
    `- Name: ${profile.name}`,
    `- Plan: ${plan.name} (software + mentor access only — **not** a different AI)`,
    `- Role: ${profile.role}`,
    profile.grade ? `- Grade: ${profile.grade}` : null,
    profile.focus ? `- Stated focus: ${profile.focus}` : null,
    "",
    "**Prelude AI is the same assistant for all plans.** Plans change roadmap/software features and mentor access:",
    `- Mentor: ${plan.mentorSessions}; ${plan.messaging}`,
    "",
    "When suggesting upgrades, mention **mentor sessions**, **messaging**, or **roadmap tools** — never a 'better AI' or 'AI tier'.",
    "",
    "Use their name naturally."
  ]
    .filter(Boolean)
    .join("\n");
}

export function getPersonalizedOpening(profile) {
  if (!profile) return getOpeningMessage();

  const plan = getPlan(profile.plan);
  const firstName = profile.name.split(" ")[0];
  const gradeBit = profile.grade ? ` I see you're in grade ${profile.grade}.` : "";
  const focusBit = profile.focus ? ` You're focused on ${profile.focus}.` : "";

  return `Hi ${firstName} — I'm **${PRELUDE_AI_NAME}**. I help organize your application process and guide you toward the right Prelude mentors.${gradeBit}${focusBit} Your **${plan.name}** plan includes ${plan.mentorSessions.toLowerCase()} and our full dashboard tools. What would you like help with today?`;
}

export function personalizeRuleBasedReply(reply, profile) {
  if (!profile) return reply;

  const plan = getPlan(profile.plan);
  const firstName = profile.name.split(" ")[0];
  const planNote = `\n\nYour **${plan.name}** plan includes ${plan.mentorSessions.toLowerCase()} — ask me about deadlines, essays, or mentor matching anytime.`;

  if (reply.text.includes(firstName)) return reply;

  return {
    ...reply,
    text: `${firstName}, ${reply.text}${planNote}`
  };
}

export { PRELUDE_AI_RESPONSIBILITIES, PRELUDE_AI_NAME };
