/** Quality checks for agent replies — used in tests and training scripts. */

const DEFLECTION_PATTERNS = [
  /^that's exactly the kind of thing a prelude mentor/i,
  /^a prelude mentor (can|would) help with that in detail/i,
  /^i can help identify what support you need, but a mentor/i
];

const SUBSTANCE_SIGNALS =
  /\b(fafsa|fafsa|css profile|safety|target|reach|early action|early decision|650|common app|scholarship|grant|work-study|undecided|test.?optional|sat|act|deadline|october|binding|non-binding|transfer|visa|toefl|net price|merit|personal statement|supplement|prior-prior|studentaid)\b/i;

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isDeflectionOnly(text) {
  const trimmed = text.trim();
  if (DEFLECTION_PATTERNS.some((re) => re.test(trimmed))) return true;
  if (wordCount(trimmed) < 25 && /mentor/i.test(trimmed)) return true;
  return false;
}

export function hasSubstantiveContent(text) {
  if (isDeflectionOnly(text)) return false;
  if (!SUBSTANCE_SIGNALS.test(text) && wordCount(text) < 40) return false;
  return wordCount(text) >= 15;
}

export function evaluateResponse(text, expectations = {}) {
  const failures = [];
  const words = wordCount(text);

  if (expectations.minWords && words < expectations.minWords) {
    failures.push(`Expected at least ${expectations.minWords} words, got ${words}`);
  }

  if (expectations.mustMatch) {
    for (const pattern of expectations.mustMatch) {
      if (!pattern.test(text)) {
        failures.push(`Missing required pattern: ${pattern}`);
      }
    }
  }

  if (expectations.mustNotMatch) {
    for (const pattern of expectations.mustNotMatch) {
      if (pattern.test(text)) {
        failures.push(`Forbidden pattern matched: ${pattern}`);
      }
    }
  }

  if (expectations.mustNotBeDeflectionOnly && isDeflectionOnly(text)) {
    failures.push("Response is deflection-only with no broad answer");
  }

  if (expectations.requireSubstance !== false && !hasSubstantiveContent(text)) {
    failures.push("Response lacks substantive educational content");
  }

  return { pass: failures.length === 0, failures, words };
}
