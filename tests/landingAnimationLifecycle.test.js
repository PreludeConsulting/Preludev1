import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("landing animation lifecycle contracts", () => {
  it("does not mount the invisible scroll-progress RAF loop", () => {
    expect(source("src/App.jsx")).not.toContain("HomepageScrollProgress");
  });

  it("keeps production hero animation free of per-frame diagnostics and layout animation", () => {
    const intro = source("src/components/hero/PreludeMatchIntro.jsx");
    const timeline = source("src/lib/preludeMatchCinematicMotion.js");
    expect(intro).not.toContain("cinematicCurrentMs");
    expect(intro).not.toContain("onUpdate:");
    expect(timeline).not.toContain("maxHeight:");
  });

  it("pauses persistent React demos using shared viewport activity", () => {
    expect(source("src/components/student-network/Carousel.jsx")).toContain("useViewportActivity");
    expect(source("src/components/student-network/AnimatedChatDemo.jsx")).toContain("useViewportActivity");
    expect(source("src/components/TrueFocus.jsx")).toContain("useViewportActivity");
  });

  it("uses a single carousel track transform instead of per-card 3D subscriptions", () => {
    const carousel = source("src/components/student-network/Carousel.jsx");
    expect(carousel).not.toContain("rotateY");
    expect(carousel).not.toContain("useTransform");
    expect(carousel).not.toContain('type: "spring"');
  });

  it("does not animate blur or frame width and height in TrueFocus", () => {
    const component = source("src/components/TrueFocus.jsx");
    expect(component).not.toContain("filter:");
    expect(component).not.toMatch(/animate=\{\{[\s\S]*?width:/);
    expect(component).not.toMatch(/animate=\{\{[\s\S]*?height:/);
  });

  it("avoids fixed body backgrounds and Anime.js shadow animation", () => {
    expect(source("src/index.css")).not.toContain("background-attachment: fixed");
    expect(source("src/lib/buttonHoverMotion.js")).not.toContain("boxShadow:");
  });
});
