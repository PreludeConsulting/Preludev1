const TYPO_REPLACEMENTS = [
  [/\bhavard\b/g, "harvard"],
  [/\bhavards\b/g, "harvard"],
  [/\bharverd\b/g, "harvard"],
  [/\bharvards\b/g, "harvard"],
  [/\bharvardd\b/g, "harvard"],
  [/\bgeoriga\b/g, "georgia"],
  [/\bgeorigia\b/g, "georgia"],
  [/\bupen\b/g, "upenn"],
  [/\bcolledge\b/g, "college"],
  [/\bcolledges\b/g, "colleges"],
  [/\bcolleges\b/g, "colleges"],
  [/\bscholorships?\b/g, "scholarship"],
  [/\bscholarships?\b/g, "scholarship"],
  [/\bextracuriculars?\b/g, "extracurricular"],
  [/\bextracuricular\b/g, "extracurricular"],
  [/\bsummer progrms?\b/g, "summer program"],
  [/\bsummer programs?\b/g, "summer program"],
  [/\bfinacial\b/g, "financial"],
  [/\bfinancal\b/g, "financial"],
  [/\bactivites\b/g, "activities"],
  [/\bactivitites\b/g, "activities"],
  [/\baplication\b/g, "application"],
  [/\baplications\b/g, "applications"],
  [/\bcommon app activites\b/g, "common app activities"],
  [/\brec letters?\b/g, "recommendation letters"],
  [/\breccomendation\b/g, "recommendation"],
  [/\bessay\b/g, "essay"],
  [/\bessasy\b/g, "essay"],
  [/\bbeter\b/g, "better"],
  [/\bwit\b/g, "with"],
  [/\buniveristy\b/g, "university"],
  [/\buniverstiy\b/g, "university"],
  [/\baccepatnce\b/g, "acceptance"],
  [/\baccepatance\b/g, "acceptance"],
  [/\bsat avrg\b/g, "sat average"],
  [/\bsat avg\b/g, "sat average"],
  [/\bcomp sci\b/g, "computer science"],
  [/\bcompsci\b/g, "computer science"],
  [/\bpre med\b/g, "pre-med"],
  [/\bearly decison\b/g, "early decision"],
  [/\bearly desicion\b/g, "early decision"]
];

const ABBREVIATION_EXPANSIONS = [
  [/\bed\b/gi, "early decision"],
  [/\bea\b/gi, "early action"],
  [/\brd\b/gi, "regular decision"],
  [/\bfafsa\b/gi, "fafsa"],
  [/\bcss profile\b/gi, "css profile"],
  [/\bloci\b/gi, "letter of continued interest"]
];

export function normalizeUserInput(message) {
  let text = String(message ?? "")
    .toLowerCase()
    .replace(/[`’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const corrections = [];
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    if (pattern.test(text)) {
      corrections.push({ from: pattern.source, to: replacement });
      text = text.replace(pattern, replacement);
    }
  }

  for (const [pattern, replacement] of ABBREVIATION_EXPANSIONS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
    }
  }

  return {
    original: String(message ?? "").trim(),
    text,
    corrections
  };
}

export function normalizeForIntentDetection(message) {
  const { text, corrections, original } = normalizeUserInput(message);
  return { text, corrections, original };
}
