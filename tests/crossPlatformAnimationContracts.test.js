import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("cross-platform animation contracts", () => {
  it("keeps the PreludeMatch wordmark geometrically stable and avoids per-frame text writes", () => {
    const motion = read("src/lib/preludeMatchCinematicMotion.js");
    const beats = read("src/components/hero/PreludeMatchCinematicBeats.jsx");
    const wordmarkMotion = motion.slice(
      motion.indexOf("function addExitAndWordmark"),
      motion.indexOf("function addPigMoment")
    );

    expect(beats).toContain('className="pm-cinematic__progress-value">100%');
    expect(motion).not.toContain("innerHTML:");
    expect(wordmarkMotion).not.toContain("{ to: 1.14");
    expect(wordmarkMotion).not.toContain("translateY: [8, 0]");
    expect(motion).not.toContain("function addCameraMotion");
  });

  it("uses one card-state transition without perpetual floats or layout measurement", () => {
    const component = read("src/components/TrueFocus.jsx");
    const styles = read("src/components/TrueFocus.css");

    expect(component).not.toContain("ResizeObserver");
    expect(component).not.toContain("getBoundingClientRect");
    expect(component).not.toContain("requestAnimationFrame");
    expect(styles).not.toContain("parent-card-float");
    expect(styles).not.toMatch(/\.focus-word__visual[\s\S]*?filter:/);
    expect(styles).toContain("var(--motion-duration-slow)");
    expect(styles).toContain("var(--motion-ease-standard)");
  });

  it("does not use blur filters in the cinematic surface", () => {
    const styles = read("src/index.css");
    const cinematic = styles.slice(
      styles.indexOf(".pm-card-wrap__glow"),
      styles.indexOf(".pm-boot")
    );

    expect(cinematic).not.toMatch(/^\s*filter:\s*blur\(/m);
  });

  it("binds the integrated dev server to Playwright's IPv4 host", () => {
    const devAll = read("scripts/dev-all.mjs");
    const playwright = read("playwright.config.js");

    expect(playwright).toContain('baseURL: "http://127.0.0.1:5173"');
    expect(devAll).toContain('"--host", "127.0.0.1"');
  });

});
