import { getCollegeByUnitId, searchColleges } from "./colleges.js";

/** Canonical College Scorecard names and unit IDs for common aliases. */
const ALIAS_ENTRIES = [
  {
    aliases: ["gt", "georgia tech", "gatech"],
    canonicalName: "Georgia Institute of Technology-Main Campus",
    unitid: "139755"
  },
  {
    aliases: ["uga", "university of georgia"],
    canonicalName: "University of Georgia",
    unitid: "139959"
  },
  {
    aliases: ["gsu", "georgia state", "georgia state university"],
    canonicalName: "Georgia State University",
    unitid: "139940"
  },
  {
    aliases: ["ucla", "university of california los angeles", "university of california-los angeles"],
    canonicalName: "University of California-Los Angeles",
    unitid: "110662"
  },
  {
    aliases: ["usc", "university of southern california"],
    canonicalName: "University of Southern California",
    unitid: "123961"
  },
  {
    aliases: ["mit", "massachusetts institute of technology"],
    canonicalName: "Massachusetts Institute of Technology",
    unitid: "166683"
  },
  {
    aliases: ["gsmst", "gwinnett school of mathematics science and technology"],
    canonicalName: "Gwinnett School of Mathematics, Science, and Technology"
  }
];

export function normalizeAliasKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_LOOKUP = new Map();
for (const entry of ALIAS_ENTRIES) {
  for (const alias of entry.aliases) {
    ALIAS_LOOKUP.set(normalizeAliasKey(alias), entry);
  }
}

export function expandCollegeSearchQuery(input) {
  const originalPhrase = String(input ?? "").trim();
  const entry = ALIAS_LOOKUP.get(normalizeAliasKey(originalPhrase));
  return entry?.canonicalName ?? originalPhrase;
}

export function resolveCollegeAlias(input) {
  const originalPhrase = String(input ?? "").trim();
  const normalized = normalizeAliasKey(originalPhrase);
  if (!normalized) {
    return {
      canonicalName: null,
      unitid: null,
      confidence: "none",
      originalPhrase,
      ambiguous: false
    };
  }

  const entry = ALIAS_LOOKUP.get(normalized);
  if (entry) {
    return {
      canonicalName: entry.canonicalName,
      unitid: entry.unitid ?? null,
      confidence: "high",
      originalPhrase,
      ambiguous: false
    };
  }

  const canUseFuzzyCollegeSearch =
    /\b(university|college|institute|campus)\b/i.test(originalPhrase) ||
    normalized.split(" ").length >= 3;
  if (!canUseFuzzyCollegeSearch) {
    return {
      canonicalName: null,
      unitid: null,
      confidence: "none",
      originalPhrase,
      ambiguous: false
    };
  }

  const { results } = searchColleges({ q: originalPhrase, limit: 5 });
  if (!results.length) {
    return {
      canonicalName: null,
      unitid: null,
      confidence: "none",
      originalPhrase,
      ambiguous: false
    };
  }

  const exact = results.find(
    (row) => normalizeAliasKey(row.name) === normalized || row.name.toLowerCase() === normalized
  );
  if (exact) {
    return {
      canonicalName: exact.name,
      unitid: exact.unitid,
      confidence: "high",
      originalPhrase,
      ambiguous: false
    };
  }

  if (results.length === 1) {
    return {
      canonicalName: results[0].name,
      unitid: results[0].unitid,
      confidence: "medium",
      originalPhrase,
      ambiguous: false
    };
  }

  return {
    canonicalName: null,
    unitid: null,
    confidence: "low",
    originalPhrase,
    ambiguous: true,
    candidates: results.slice(0, 3).map((row) => ({ name: row.name, unitid: row.unitid }))
  };
}

export function lookupCollegeByAliasOrName(nameOrAlias) {
  const resolved = resolveCollegeAlias(nameOrAlias);
  if (resolved.unitid) {
    const college = getCollegeByUnitId(resolved.unitid);
    if (college) {
      return {
        ...resolved,
        college,
        verifiedCollegeRecord: college
      };
    }
  }

  if (resolved.canonicalName) {
    const { results } = searchColleges({ q: resolved.canonicalName, limit: 1 });
    if (results[0]) {
      return {
        ...resolved,
        unitid: results[0].unitid,
        college: results[0],
        verifiedCollegeRecord: results[0]
      };
    }
  }

  return {
    ...resolved,
    college: null,
    verifiedCollegeRecord: null
  };
}

const COMPARISON_SPLIT =
  /\b(?:or|vs\.?|versus|and|between|compared to|compared with)\b/i;

export function extractCollegeAliasPhrases(text) {
  const phrases = new Set();
  const normalizedText = ` ${text} `;

  for (const entry of ALIAS_ENTRIES) {
    for (const alias of entry.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern =
        alias.length <= 4
          ? new RegExp(`(?:^|[\\s,;])${escaped}(?:[\\s,;.?]|$)`, "i")
          : new RegExp(`\\b${escaped}\\b`, "i");
      const negated = new RegExp(`\\bnot\\s+${escaped}\\b`, "i").test(text);
      if (!negated && pattern.test(normalizedText)) {
        phrases.add(alias);
      }
    }
  }

  for (const match of text.matchAll(/\bUniversity of [A-Za-z][A-Za-z\s\-]{2,40}\b/g)) {
    phrases.add(match[0].trim());
  }

  const hasComparisonLanguage =
    /\b(compare|versus|vs\.?|better than|which is better|between|compared to|compared with)\b/i.test(text);
  if (hasComparisonLanguage) {
    const comparisonChunk = text.split(COMPARISON_SPLIT);
    for (const chunk of comparisonChunk) {
      const trimmed = chunk
        .replace(/\b(which is better|which one|compare|better|for|cs|computer science|major|program)\b/gi, " ")
        .trim();
      if (trimmed.length >= 2 && trimmed.length <= 60) {
        const tokens = trimmed.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
        for (const token of tokens) {
          if (token.length >= 2) phrases.add(token);
        }
      }
    }
  }

  return [...phrases].slice(0, 4);
}

export function resolveCollegesFromText(text) {
  const phrases = extractCollegeAliasPhrases(text);
  const schools = [];
  const seen = new Set();

  for (const phrase of phrases) {
    const lookup = lookupCollegeByAliasOrName(phrase);
    if (!lookup.college || seen.has(lookup.unitid)) continue;
    seen.add(lookup.unitid);
    schools.push({
      canonicalName: lookup.canonicalName ?? lookup.college.name,
      aliasUsed: phrase,
      unitid: lookup.unitid,
      confidence: lookup.confidence,
      verifiedCollegeRecord: lookup.college
    });
  }

  return schools;
}
