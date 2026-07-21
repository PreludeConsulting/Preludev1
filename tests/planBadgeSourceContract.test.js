import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = "src";
const ALLOWED_COPY_OWNERS = new Set([
  "src/lib/planBadges.js",
  "src/lib/translations.js"
]);

const FORBIDDEN_PATTERNS = [
  { name: "Most Popular", pattern: /Most Popular/g },
  { name: "Most popular", pattern: /Most popular/g },
  { name: "Best Value", pattern: /Best Value/g },
  { name: "Best value", pattern: /Best value/g },
  { name: "Most Value", pattern: /Most Value/g },
  { name: "isRecommended", pattern: /\bisRecommended\b/g }
];

const RECOMMENDED_BRANCH_VIOLATION = "plan badge branch containing Recommended";
const MULTI_CHARACTER_TOKENS = ["===", "!==", "=>", "?.", "??", "&&", "||", "==", "!=", "<=", ">="];

function tokenizeSource(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (source.startsWith("//", index)) {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const start = index;
      const quote = character;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      tokens.push({
        type: "literal",
        value: source.slice(start + 1, Math.max(start + 1, index - 1)),
        start,
        end: index
      });
      continue;
    }

    const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/)?.[0];
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier, start: index, end: index + identifier.length });
      index += identifier.length;
      continue;
    }

    const operator = MULTI_CHARACTER_TOKENS.find((candidate) => source.startsWith(candidate, index));
    const value = operator ?? character;
    tokens.push({ type: "punctuation", value, start: index, end: index + value.length });
    index += value.length;
  }

  return tokens;
}

function isPlanLikeIdentifier(identifier) {
  const segments = identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_]+/)
    .map((segment) => segment.toLowerCase());
  return segments.some((segment) => ["plan", "subscription", "membership"].includes(segment));
}

function findConditionStart(tokens, questionIndex) {
  const depth = { ")": 0, "]": 0, "}": 0 };
  const openingToClosing = { "(": ")", "[": "]", "{": "}" };
  const boundaries = new Set([",", ";", ":", "?", "=", "=>"]);

  for (let index = questionIndex - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (Object.hasOwn(depth, token.value)) {
      depth[token.value] += 1;
      continue;
    }
    if (Object.hasOwn(openingToClosing, token.value)) {
      const closing = openingToClosing[token.value];
      if (depth[closing] > 0) {
        depth[closing] -= 1;
        continue;
      }
      return index + 1;
    }
    if (Object.values(depth).some(Boolean)) continue;
    if (boundaries.has(token.value) || (token.type === "identifier" && token.value === "return")) {
      return index + 1;
    }
  }

  return 0;
}

function findMatchingColon(tokens, questionIndex) {
  const depth = { "(": 0, "[": 0, "{": 0 };
  const closingToOpening = { ")": "(", "]": "[", "}": "{" };
  let nestedTernaries = 0;

  for (let index = questionIndex + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value;
    if (Object.hasOwn(depth, value)) {
      depth[value] += 1;
      continue;
    }
    if (Object.hasOwn(closingToOpening, value)) {
      const opening = closingToOpening[value];
      if (depth[opening] === 0) return -1;
      depth[opening] -= 1;
      continue;
    }
    if (Object.values(depth).some(Boolean)) continue;
    if (value === "?") nestedTernaries += 1;
    if (value === ":") {
      if (nestedTernaries === 0) return index;
      nestedTernaries -= 1;
    }
  }

  return -1;
}

function findTernaryEnd(tokens, colonIndex) {
  const depth = { "(": 0, "[": 0, "{": 0 };
  const closingToOpening = { ")": "(", "]": "[", "}": "{" };
  let nestedTernaries = 0;

  for (let index = colonIndex + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value;
    if (Object.hasOwn(depth, value)) {
      depth[value] += 1;
      continue;
    }
    if (Object.hasOwn(closingToOpening, value)) {
      const opening = closingToOpening[value];
      if (depth[opening] === 0) return index;
      depth[opening] -= 1;
      continue;
    }
    if (Object.values(depth).some(Boolean)) continue;
    if (value === "?") nestedTernaries += 1;
    if (value === ":") {
      if (nestedTernaries === 0) return index;
      nestedTernaries -= 1;
      continue;
    }
    if (nestedTernaries === 0 && (value === "," || value === ";")) return index;
  }

  return tokens.length;
}

function isExactRecommendedToken(source, token) {
  if (token.type === "literal") return token.value.toLowerCase() === "recommended";
  if (token.type !== "identifier" || token.value.toLowerCase() !== "recommended") return false;

  const before = source.slice(0, token.start).match(/\S\s*$/)?.[0]?.trim();
  const after = source.slice(token.end).match(/^\s*\S/)?.[0]?.trim();
  return before === ">" && after === "<";
}

function findRecommendedBranchViolations(source, tokens) {
  const ternaries = tokens.flatMap((token, questionIndex) => {
    if (token.value !== "?") return [];
    const colonIndex = findMatchingColon(tokens, questionIndex);
    if (colonIndex === -1) return [];
    return [{
      questionIndex,
      colonIndex,
      endIndex: findTernaryEnd(tokens, colonIndex),
      conditionStart: findConditionStart(tokens, questionIndex)
    }];
  });

  return tokens.flatMap((token, tokenIndex) => {
    if (!isExactRecommendedToken(source, token)) return [];
    const owner = ternaries
      .filter(({ questionIndex, endIndex }) => tokenIndex > questionIndex && tokenIndex < endIndex)
      .sort((left, right) => (left.endIndex - left.questionIndex) - (right.endIndex - right.questionIndex))[0];
    if (!owner) return [];
    const conditionTokens = tokens.slice(owner.conditionStart, owner.questionIndex);
    if (!conditionTokens.some((candidate) => candidate.type === "identifier" && isPlanLikeIdentifier(candidate.value))) {
      return [];
    }
    return [{ name: RECOMMENDED_BRANCH_VIOLATION, index: token.start }];
  });
}

function findViolations(source) {
  const violations = FORBIDDEN_PATTERNS.flatMap(({ name, pattern }) => {
    pattern.lastIndex = 0;
    return [...source.matchAll(pattern)].map((match) => ({ name, index: match.index }));
  });
  const tokens = tokenizeSource(source);
  return [...violations, ...findRecommendedBranchViolations(source, tokens)];
}

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listSourceFiles(absolutePath);
      return /\.jsx?$/.test(entry.name) ? [absolutePath] : [];
    });
}

function toProjectPath(absolutePath) {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function violationNamesFor(source) {
  return findViolations(source).map(({ name }) => name);
}

describe("subscription plan Recommended badge detector", () => {
  it.each([
    'const badge = selectedPlanId === "plus" ? "Recommended" : null;',
    'const badge = selectedPlanId === "plus" ? <Badge>Recommended</Badge> : null;',
    'const badge = currentPlan?.id === "pro" ? "recommended" : null;',
    'const badge = subscriptionPlan ? "RECOMMENDED" : null;',
    'const badge = activeMembership?.planId ? `Recommended` : null;',
    'const badge = PlanId === "basic" ? null : "Recommended";',
    'const badge = ACTIVE_PLAN === "pro" ? `Recommended` : null;'
  ])("flags an exact Recommended badge literal for %s", (source) => {
    expect(violationNamesFor(source)).toContain("plan badge branch containing Recommended");
  });

  it.each([
    'const copy = membership ? "Your recommended mentor" : "Find a mentor";',
    '<h3>Recommended from your questionnaire</h3>;',
    'const recommended = getRecommendedEarnAction(coinsNeeded);',
    'const note = currentPlan ? "This plan is recommended for mentors" : "";',
    'const label = selectedPlanId ? "Recommendations" : "Explore";',
    'const label = explanation ? "Recommended" : "Optional";',
    'const label = mentorMatch ? "Recommended" : "Another mentor";',
    'renderPlan(plan, mentorMatch ? "Recommended" : "Other");',
    'const label = currentPlan && (mentorMatch ? "Recommended" : "Other");',
    'const label = selectedPlanId ? (mentorMatch ? "Recommended" : "Other") : "No plan";'
  ])("allows unrelated recommendation copy: %s", (source) => {
    expect(violationNamesFor(source)).toEqual([]);
  });
});

describe("subscription plan badge source contract", () => {
  it("keeps promotional plan badge copy in the approved owners", () => {
    const violations = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), SOURCE_ROOT))) {
      const projectPath = toProjectPath(absolutePath);
      if (ALLOWED_COPY_OWNERS.has(projectPath)) continue;

      const source = fs.readFileSync(absolutePath, "utf8");
      for (const { name, index } of findViolations(source)) {
        violations.push(`${projectPath}:${lineNumberAt(source, index)} (${name})`);
      }
    }

    expect(violations).toEqual([]);
  });
});
