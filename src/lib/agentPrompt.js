import systemPrompt from "../../AGENT.md?raw";
import { QUICK_MENU as FALLBACK_QUICK_MENU } from "./preludeChatData.js";

/** Full system prompt — edit AGENT.md at the repo root to change agent behavior. */
export const SYSTEM_PROMPT = systemPrompt;

const QUICK_MENU_IDS = ["start", "colleges", "essays", "aid", "major", "parent"];

export function getOpeningMessage() {
  const quoted = systemPrompt.match(/Example opening:\s*\n+\s*"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];

  const plain = systemPrompt.match(/Example opening:\s*\n+\s*([^\n]+)/);
  return plain?.[1]?.trim() ?? FALLBACK_OPENING;
}

export function getQuickMenuItems() {
  const confusedBlock = systemPrompt.match(
    /If the user seems confused, give them a simple menu:[\s\S]*?(?=\n\nIf the user asks what Prelude)/
  );
  if (!confusedBlock) return FALLBACK_QUICK_MENU;

  const labels = [...confusedBlock[0].matchAll(/^\d+\.\s+(.+)$/gm)].map((m) => m[1].trim());
  if (labels.length < 2) return FALLBACK_QUICK_MENU;

  return labels.map((label, index) => ({
    id: QUICK_MENU_IDS[index] ?? `menu-${index}`,
    label
  }));
}

const FALLBACK_OPENING =
  "Hi, I'm Prelude AI. I can help with college planning, applications, essays, scholarships, financial aid, or choosing the right schools. What are you most worried about right now?";
