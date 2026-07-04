import { describe, expect, it } from "vitest";
import {
  applyStyles,
  buildEnterScrollOptions,
  buildScrubScrollOptions,
  combineReverts,
  createEnterReveal,
  createMultiPropertyEnter,
  createScrollScrub,
  createSplitLineReveal,
  createStaggerReveal,
  enterFinalState,
  enterHiddenState,
  enterHiddenStateScaled,
  snapEnterFinalState,
  SCROLL_MOTION,
  TIER1_DEFAULTS,
  TIER2_DEFAULTS
} from "../src/lib/animeScrollMotion.js";
import {
  mountHeroSetPiece,
  mountNetworkSectionSetPiece,
  mountStudentNetworkSetPiece,
  snapSetPieceRefs
} from "../src/lib/animeScrollSetPieces.js";

function fakeEl() {
  return { style: {} };
}

describe("animeScrollMotion helpers", () => {
  it("exposes tunable motion constants", () => {
    expect(SCROLL_MOTION.enterDuration).toBe(TIER1_DEFAULTS.enterDuration);
    expect(TIER1_DEFAULTS.enterDuration).toBeGreaterThan(0);
    expect(TIER2_DEFAULTS.springEase).toContain("Elastic");
  });

  it("defines hidden and final reveal states", () => {
    expect(enterFinalState()).toEqual({ opacity: "1", transform: "none" });
    expect(enterHiddenState(20)).toEqual({
      opacity: "0",
      transform: "translateY(20px)"
    });
    expect(enterHiddenStateScaled(20, 0.9).transform).toContain("scale(0.9)");
  });

  it("applyStyles writes onto element style", () => {
    const el = fakeEl();
    applyStyles(el, { opacity: "1", transform: "none" });
    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("none");
  });

  it("snapEnterFinalState reveals element and children instantly", () => {
    const el = fakeEl();
    const children = [fakeEl(), fakeEl()];
    snapEnterFinalState(el, children);
    expect(el.style.opacity).toBe("1");
    children.forEach((child) => {
      expect(child.style.opacity).toBe("1");
      expect(child.style.transform).toBe("none");
    });
  });

  it("builds one-shot enter options with play sync", () => {
    const target = fakeEl();
    const options = buildEnterScrollOptions(target);
    expect(options.target).toBe(target);
    expect(options.sync).toBe("play");
    expect(options.repeat).toBe(false);
  });

  it("builds scrubbed options with sync enabled", () => {
    const target = fakeEl();
    const options = buildScrubScrollOptions(target);
    expect(options.target).toBe(target);
    expect(options.sync).toBe(true);
  });

  it("combineReverts calls all child revert handlers", () => {
    let a = 0;
    let b = 0;
    combineReverts({ revert() { a += 1; } }, { revert() { b += 1; } }).revert();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

describe("animeScrollMotion reduced-motion behavior", () => {
  it("createEnterReveal snaps final state and skips observer", () => {
    const el = fakeEl();
    const handle = createEnterReveal(el, { reducedMotion: true });
    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("none");
    expect(() => handle.revert()).not.toThrow();
  });

  it("createMultiPropertyEnter snaps final state under reduced motion", () => {
    const el = fakeEl();
    const handle = createMultiPropertyEnter(el, { reducedMotion: true });
    expect(el.style.opacity).toBe("1");
    expect(() => handle.revert()).not.toThrow();
  });

  it("createSplitLineReveal snaps line elements under reduced motion", () => {
    const lines = [fakeEl(), fakeEl()];
    const handle = createSplitLineReveal(lines, { reducedMotion: true });
    lines.forEach((line) => expect(line.style.opacity).toBe("1"));
    expect(() => handle.revert()).not.toThrow();
  });

  it("createStaggerReveal snaps children final state", () => {
    const container = fakeEl();
    const children = [fakeEl(), fakeEl(), fakeEl()];
    const handle = createStaggerReveal(container, children, { reducedMotion: true });
    children.forEach((child) => expect(child.style.opacity).toBe("1"));
    expect(() => handle.revert()).not.toThrow();
  });

  it("createScrollScrub snaps target final state", () => {
    const target = fakeEl();
    const section = fakeEl();
    const handle = createScrollScrub(target, section, { reducedMotion: true });
    expect(target.style.opacity).toBe("1");
    expect(() => handle.revert()).not.toThrow();
  });

  it("returns a no-throw revert handle for missing elements", () => {
    expect(() => createEnterReveal(null).revert()).not.toThrow();
    expect(() => createStaggerReveal(null, []).revert()).not.toThrow();
    expect(() => createScrollScrub(null, null).revert()).not.toThrow();
  });
});

describe("animeScrollSetPieces", () => {
  it("mountHeroSetPiece snaps all hero refs under reduced motion", () => {
    const refs = {
      headlineLines: [fakeEl(), fakeEl()],
      subcopy: fakeEl(),
      formWrap: fakeEl(),
      note: fakeEl(),
      visual: fakeEl()
    };
    expect(() => mountHeroSetPiece(refs, { reducedMotion: true }).revert()).not.toThrow();
    refs.headlineLines.forEach((line) => expect(line.style.opacity).toBe("1"));
  });

  it("mountNetworkSectionSetPiece requires section ref", () => {
    expect(() => mountNetworkSectionSetPiece({}, { reducedMotion: true }).revert()).not.toThrow();
    const section = fakeEl();
    const badge = fakeEl();
    const handle = mountNetworkSectionSetPiece(
      { section, badge, headlineLines: [fakeEl()], subtitle: fakeEl() },
      { reducedMotion: true }
    );
    expect(badge.style.opacity).toBe("1");
    expect(() => handle.revert()).not.toThrow();
  });

  it("mountStudentNetworkSetPiece snaps panels under reduced motion", () => {
    const headline = fakeEl();
    const panels = [fakeEl(), fakeEl()];
    const section = fakeEl();
    mountStudentNetworkSetPiece(
      { section, headline, panelEls: panels },
      { reducedMotion: true }
    );
    expect(headline.style.opacity).toBe("1");
    panels.forEach((panel) => expect(panel.style.opacity).toBe("1"));
  });

  it("snapSetPieceRefs flattens ref object values", () => {
    const a = fakeEl();
    const b = fakeEl();
    snapSetPieceRefs({ headline: a, lines: [b] });
    expect(a.style.opacity).toBe("1");
    expect(b.style.opacity).toBe("1");
  });
});
