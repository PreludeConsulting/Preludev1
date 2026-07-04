import { describe, expect, it } from "vitest";
import {
  AURA_LERP,
  AURA_SIZE_PX,
  followAlpha,
  lerp,
  lerpPoint,
  pointerCoords
} from "../src/lib/auraCursorMotion.js";

describe("auraCursorMotion", () => {
  it("lerps toward a target point", () => {
    const next = lerpPoint(0, 0, 100, 50, 0.5);
    expect(next.x).toBe(50);
    expect(next.y).toBe(25);
  });

  it("snaps when reduced motion is enabled", () => {
    expect(followAlpha(0.18, true)).toBe(1);
    expect(followAlpha(undefined, false)).toBe(AURA_LERP);
  });

  it("exposes pointer coordinate helpers", () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(pointerCoords({ clientX: 12, clientY: 34 })).toEqual({ x: 12, y: 34 });
    expect(AURA_SIZE_PX).toBeGreaterThan(0);
  });
});
