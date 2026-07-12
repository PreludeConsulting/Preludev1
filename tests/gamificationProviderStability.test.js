import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("dashboard gamification provider stability", () => {
  it("memoizes fallback provider inputs and normalized rewards state", () => {
    const shell = read("src/dashboard/components/StudentGamificationShell.jsx");
    const rewards = read("src/dashboard/context/ProgressRewardsContext.jsx");
    expect(shell).toContain("useMemo");
    expect(shell).toMatch(/const initialGamification = useMemo\(/);
    expect(shell).toMatch(/const initialRewards = useMemo\(/);
    expect(rewards).toMatch(/const normalizedInitial = useMemo\(\(\) => normalizeRewardsState\(initial\), \[initial\]\)/);
  });
});
