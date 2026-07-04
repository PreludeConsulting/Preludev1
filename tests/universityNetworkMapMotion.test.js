import { describe, expect, it } from "vitest";
import {
  MAP_MOTION_MS,
  MAP_PIN_SCROLL_VH,
  applyNetworkDrawProgress,
  attachNetworkMapScrollDraw,
  attachNetworkMapScrollPin,
  attachNetworkMapViewportDraw,
  getNetworkMapDrawProgress,
  resetNetworkEdges,
  runNetworkDrawCycle,
  snapNetworkVisible
} from "../src/lib/universityNetworkMapMotion.js";

describe("universityNetworkMapMotion", () => {
  it("exports draw and pin timing constants", () => {
    expect(MAP_MOTION_MS.draw).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stagger).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stagger).toBeGreaterThanOrEqual(MAP_MOTION_MS.draw);
    expect(MAP_MOTION_MS.pulse).toBeGreaterThan(0);
    expect(MAP_PIN_SCROLL_VH).toBeGreaterThan(100);
  });

  it("applyNetworkDrawProgress reveals edges sequentially", () => {
    const el = {
      getTotalLength: () => 100,
      style: { strokeDasharray: "", strokeDashoffset: "", opacity: "", filter: "" },
      classList: { add() {}, remove() {}, toggle() {} }
    };

    applyNetworkDrawProgress([el], 0);
    expect(el.style.strokeDashoffset).toBe("100");

    applyNetworkDrawProgress([el], 1);
    expect(el.style.strokeDashoffset).toBe("0");
  });

  it("snapNetworkVisible tolerates empty lists", () => {
    expect(() => snapNetworkVisible([])).not.toThrow();
  });

  it("resetNetworkEdges restores draw-ready stroke state", () => {
    const el = {
      getTotalLength: () => 120,
      style: {
        strokeDasharray: "",
        strokeDashoffset: "0",
        opacity: "0.52"
      }
    };

    resetNetworkEdges([el]);

    expect(el.style.strokeDasharray).toBe("120");
    expect(el.style.strokeDashoffset).toBe("120");
    expect(el.style.opacity).toBe("0");
  });

  it("runNetworkDrawCycle returns a cancellable controller", () => {
    const controller = runNetworkDrawCycle({ edgeEls: [] });
    expect(controller).toBeNull();
  });

  it("runNetworkDrawCycle cancel stops without throwing", () => {
    const el = {
      getTotalLength: () => 120,
      style: {
        strokeDasharray: "",
        strokeDashoffset: "",
        opacity: ""
      }
    };

    const controller = runNetworkDrawCycle({ edgeEls: [el] });
    expect(controller).not.toBeNull();
    expect(() => controller?.cancel()).not.toThrow();
  });

  it("attachNetworkMapScrollDraw returns revert handle", () => {
    const el = {
      getTotalLength: () => 120,
      style: {
        strokeDasharray: "",
        strokeDashoffset: "",
        opacity: ""
      }
    };

    const handle = attachNetworkMapScrollDraw({
      edgeEls: [el],
      scrollTarget: null
    });
    expect(() => handle.revert()).not.toThrow();
  });

  it("attachNetworkMapScrollPin snaps under reduced motion", () => {
    const el = {
      getTotalLength: () => 120,
      style: {
        strokeDasharray: "",
        strokeDashoffset: "",
        opacity: ""
      }
    };

    attachNetworkMapScrollPin({
      mapEl: { getBoundingClientRect: () => ({ top: 0, height: 100, bottom: 100 }) },
      edgeEls: [el],
      reducedMotion: true
    });

    expect(el.style.strokeDashoffset).toBe("0");
    expect(el.style.opacity).toBe("0.52");
  });

  it("getNetworkMapDrawProgress returns clamped values", () => {
    const target = { getBoundingClientRect: () => ({ top: 400, height: 300 }) };
    const progress = getNetworkMapDrawProgress(target);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it("attachNetworkMapViewportDraw returns revert handle", () => {
    const el = {
      getTotalLength: () => 120,
      style: { strokeDasharray: "", strokeDashoffset: "", opacity: "", filter: "" },
      classList: { add() {}, remove() {}, toggle() {} }
    };
    const target = { getBoundingClientRect: () => ({ top: 200, height: 300, bottom: 500 }) };
    const mapEl = { classList: { add() {}, remove() {}, toggle() {} } };

    const handle = attachNetworkMapViewportDraw({
      scrollTarget: target,
      mapEl,
      edgeEls: [el]
    });
    expect(() => handle.revert()).not.toThrow();
  });

  it("attachNetworkMapScrollPin returns revert handle", () => {
    const handle = attachNetworkMapScrollPin({ pinSpacerEl: null });
    expect(() => handle.revert()).not.toThrow();
    expect(() => handle.collapseRunway?.()).not.toThrow();
  });

  it("attachNetworkMapScrollDraw snaps under reduced motion", () => {
    const el = {
      getTotalLength: () => 120,
      style: {
        strokeDasharray: "",
        strokeDashoffset: "",
        opacity: ""
      }
    };
    const target = { getBoundingClientRect: () => ({ top: 0, height: 100 }) };

    attachNetworkMapScrollDraw({
      edgeEls: [el],
      scrollTarget: target,
      reducedMotion: true
    });

    expect(el.style.strokeDashoffset).toBe("0");
    expect(el.style.opacity).toBe("0.52");
  });
});
