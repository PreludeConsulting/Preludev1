import { describe, expect, it } from "vitest";
import {
  MOTION_TIERS,
  detectMotionTier,
  isMotionActive
} from "../src/lib/motion/motionPolicy.js";

describe("landing motion policy", () => {
  it("uses reduced motion as the strongest signal", () => {
    expect(detectMotionTier({ reducedMotion: true, hardwareConcurrency: 16, deviceMemory: 32 })).toBe(
      MOTION_TIERS.reduced
    );
  });

  it("selects lite motion for constrained CPU or memory", () => {
    expect(detectMotionTier({ hardwareConcurrency: 4, deviceMemory: 16, coarsePointer: false })).toBe(
      MOTION_TIERS.lite
    );
    expect(detectMotionTier({ hardwareConcurrency: 16, deviceMemory: 4, coarsePointer: false })).toBe(
      MOTION_TIERS.lite
    );
  });

  it("uses lite motion for coarse pointers and full motion for capable devices", () => {
    expect(detectMotionTier({ hardwareConcurrency: 16, deviceMemory: 16, coarsePointer: true })).toBe(
      MOTION_TIERS.lite
    );
    expect(detectMotionTier({ hardwareConcurrency: 16, deviceMemory: 16, coarsePointer: false })).toBe(
      MOTION_TIERS.full
    );
  });

  it("does not penalize browsers that omit optional hardware hints", () => {
    expect(detectMotionTier({ hardwareConcurrency: undefined, deviceMemory: undefined, coarsePointer: false })).toBe(
      MOTION_TIERS.full
    );
  });

  it("requires both document and viewport visibility for persistent motion", () => {
    expect(isMotionActive({ documentVisible: true, inViewport: true, reducedMotion: false })).toBe(true);
    expect(isMotionActive({ documentVisible: false, inViewport: true, reducedMotion: false })).toBe(false);
    expect(isMotionActive({ documentVisible: true, inViewport: false, reducedMotion: false })).toBe(false);
    expect(isMotionActive({ documentVisible: true, inViewport: true, reducedMotion: true })).toBe(false);
  });
});
