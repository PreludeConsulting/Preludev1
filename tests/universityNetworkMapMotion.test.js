import { describe, expect, it } from "vitest";
import {
  MAP_MOTION_MS,
  resetNetworkEdges,
  runNetworkCycleLoop,
  snapNetworkVisible
} from "../src/lib/universityNetworkMapMotion.js";

describe("universityNetworkMapMotion", () => {
  it("exports draw, pulse, and cycle timing constants", () => {
    expect(MAP_MOTION_MS.draw).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.stagger).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.pulse).toBeGreaterThan(0);
    expect(MAP_MOTION_MS.cycle).toBe(10000);
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
        opacity: "0.32"
      }
    };

    resetNetworkEdges([el]);

    expect(el.style.strokeDasharray).toBe("120");
    expect(el.style.strokeDashoffset).toBe("120");
    expect(el.style.opacity).toBe("0.18");
  });

  it("runNetworkCycleLoop returns a cancellable controller", () => {
    const controller = runNetworkCycleLoop({ edgeEls: [] });
    expect(controller).toBeNull();
  });
});
