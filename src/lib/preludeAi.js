/** Core duties of Prelude AI — same for every member; plans differ by software + mentor access only. */

import { isPreludeAiEnabled as readPreludeAiEnabled, PRELUDE_AI_DISABLED_MESSAGE } from "../../shared/preludeAiEnabled.js";

export { PRELUDE_AI_DISABLED_MESSAGE };

/** Client-side feature flag (Vite). Off unless VITE_PRELUDE_AI_ENABLED is truthy. */
export function isPreludeAiEnabled() {
  return readPreludeAiEnabled({
    PRELUDE_AI_ENABLED: import.meta.env?.VITE_PRELUDE_AI_ENABLED,
    VITE_PRELUDE_AI_ENABLED: import.meta.env?.VITE_PRELUDE_AI_ENABLED
  });
}

export const PRELUDE_AI_RESPONSIBILITIES = [
  "Central application dashboard — help users see tasks, schools, and progress in one place",
  "Deadline tracking — remind users of EA, ED, RD, scholarship, and school-specific dates",
  "Essay prompt organization — clarify personal statement vs supplements and what each school asks",
  "Profile analyzer — discuss strengths, activities, and story themes at a high level (not full reviews)",
  "Strength and opportunity suggestions — point out gaps or next steps worth exploring with a mentor",
  "Scholarship and financial aid reminders — FAFSA/CSS timing, merit vs need aid, and official sources"
];

export const PRELUDE_AI_NAME = "Prelude AI";
