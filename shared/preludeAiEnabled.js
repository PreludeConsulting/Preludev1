/**
 * Prelude AI kill switch.
 * Off by default until the college-dataset / RAG stack is reliable again.
 * Set PRELUDE_AI_ENABLED=1 (and VITE_PRELUDE_AI_ENABLED=1 for the client) to re-enable.
 */

function readFlag(env = {}) {
  const raw = env.PRELUDE_AI_ENABLED ?? env.VITE_PRELUDE_AI_ENABLED;
  if (raw == null || String(raw).trim() === "") return false;
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

export function isPreludeAiEnabled(env = typeof process !== "undefined" ? process.env : {}) {
  return readFlag(env);
}

export const PRELUDE_AI_DISABLED_MESSAGE =
  "Prelude AI is temporarily unavailable. Messaging and mentoring are unaffected.";
