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
  { name: "isRecommended", pattern: /\bisRecommended\b/g },
  {
    name: "plan badge branch containing Recommended",
    pattern: /\b(?:plan|planId|subscription|membership)\b[^;]{0,240}\?[^;]{0,240}\bRecommended\b/gi
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
