const EXPLICIT_GUARANTEE_RE =
  /\b(?:guarantee(?:d|s|ing)?|surely|certain(?:ly)?|definitely)\b|\b100\s*(?:%|percent)\b/i;

const ADMISSION_OUTCOME_RE =
  /\b(?:admission|admissions|acceptance|accepted|admitted|admit|get(?:ting)?\s+in(?:to)?|offer\s+of\s+admission)\b/i;

const INFORMATIONAL_ADMISSIONS_RE =
  /\b(?:how\s+(?:hard|difficult|competitive|selective)\s+(?:is\s+it\s+)?to\s+get\s+in(?:to)?|acceptance\s+rate|admission\s+rate|what\s+(?:gpa|sat|act|score|grades?|requirements?)\s+(?:do\s+)?i\s+need(?:\s+to\s+get\s+in(?:to)?)?)\b/i;

const ADMISSION_PREDICTION_RE =
  /\b(?:what\s+are\s+my\s+chances|my\s+chances\s+of|admission\s+chances?|chances?\s+of\s+(?:admission|acceptance|getting\s+in(?:to)?|being\s+(?:accepted|admitted))|odds?\s+of\s+(?:admission|acceptance|getting\s+in(?:to)?|being\s+(?:accepted|admitted))|(?:will|can)\s+i\s+(?:(?:get|be)\s+(?:in(?:to)?|accepted|admitted)))\b/i;

/**
 * Returns true only when the user asks Prelude to predict or guarantee an
 * admissions outcome. Questions about published requirements or selectivity
 * remain informational school-fact requests.
 */
export function isGuaranteeRequest(text) {
  const message = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!message) return false;

  if (EXPLICIT_GUARANTEE_RE.test(message) && ADMISSION_OUTCOME_RE.test(message)) {
    return true;
  }

  if (INFORMATIONAL_ADMISSIONS_RE.test(message)) {
    return false;
  }

  return ADMISSION_PREDICTION_RE.test(message);
}
