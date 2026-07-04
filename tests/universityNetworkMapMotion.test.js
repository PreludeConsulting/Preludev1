import { describe, expect, it } from "vitest";
import {
  MAP_MOTION_MS,
  resetNetworkEdges,
  runNetworkDrawCycle,
  snapNetworkVisible
} from "../src/lib/universityNetworkMapMotion.js";

describe("universityNetworkMapMotion", () => {
  it("exports draw and pulse timing constants", () => {
    expect(MAP_MOTION_MS.draw).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stagger).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.pulse).toBeGreaterThan(0);
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
    expect(el.style.opacity).toBe("0.38");
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
});
