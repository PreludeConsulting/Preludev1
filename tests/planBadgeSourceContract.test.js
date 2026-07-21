import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = "src";
const ALLOWED_COPY_OWNERS = new Set([
  "src/lib/planBadges.js",
  "src/lib/translations.js"
]);

const PLAN_LIKE_IDENTIFIER = String.raw`\b(?:plan|subscription|membership|(?:plan|subscription|membership)[A-Z_][\w$]*|[A-Za-z_$][\w$]*(?:Plan|Subscription|Membership)(?:[A-Z0-9_$][\w$]*)?|[A-Za-z_$][\w$]*(?:_plan|_subscription|_membership)[\w$]*)\b`;
const RECOMMENDED_TEXT = String.raw`[Rr][Ee][Cc][Oo][Mm][Mm][Ee][Nn][Dd][Ee][Dd]`;
const EXACT_RECOMMENDED_LITERAL = String.raw`(?:"${RECOMMENDED_TEXT}"|'${RECOMMENDED_TEXT}'|\`${RECOMMENDED_TEXT}\`)`;

const FORBIDDEN_PATTERNS = [
  { name: "Most Popular", pattern: /Most Popular/g },
  { name: "Most popular", pattern: /Most popular/g },
  { name: "Best Value", pattern: /Best Value/g },
  { name: "Best value", pattern: /Best value/g },
  { name: "Most Value", pattern: /Most Value/g },
  { name: "isRecommended", pattern: /\bisRecommended\b/g },
  {
    name: "plan badge branch containing Recommended",
    pattern: new RegExp(
      `${PLAN_LIKE_IDENTIFIER}[^;]{0,240}\\?(?![.?])[^;]{0,240}${EXACT_RECOMMENDED_LITERAL}`,
      "g"
    )
  }
];

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
  return FORBIDDEN_PATTERNS.flatMap(({ name, pattern }) => {
    pattern.lastIndex = 0;
    return [...source.matchAll(pattern)].map(() => name);
  });
}

describe("subscription plan Recommended badge detector", () => {
  it.each([
    'const badge = selectedPlanId === "plus" ? "Recommended" : null;',
    'const badge = currentPlan?.id === "pro" ? "recommended" : null;',
    'const badge = subscriptionPlan ? "RECOMMENDED" : null;',
    'const badge = activeMembership?.planId ? `Recommended` : null;'
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
    'const label = mentorMatch ? "Recommended" : "Another mentor";'
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
      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of source.matchAll(pattern)) {
          violations.push(`${projectPath}:${lineNumberAt(source, match.index)} (${name})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
