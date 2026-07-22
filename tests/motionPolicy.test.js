import { describe, expect, it } from "vitest";
import {
  MOTION_TIERS,
  detectMotionTier,
  isMotionActive,
  shouldUseStaticLandingMotion
} from "../src/lib/motion/motionPolicy.js";

describe("landing motion policy", () => {
  it("uses reduced motion as the strongest signal", () => {
    expect(detectMotionTier({ reducedMotion: true, hardwareConcurrency: 16, deviceMemory: 32 })).toBe(
      MOTION_TIERS.reduced
    );
  });

  it("keeps full motion across browser-specific hardware reports", () => {
    expect(detectMotionTier({ hardwareConcurrency: 4, deviceMemory: 16, coarsePointer: false })).toBe(
      MOTION_TIERS.full
    );
    expect(detectMotionTier({ hardwareConcurrency: 16, deviceMemory: 4, coarsePointer: false })).toBe(
      MOTION_TIERS.full
    );
    expect(detectMotionTier({ hardwareConcurrency: 16, deviceMemory: 16, coarsePointer: true })).toBe(
      MOTION_TIERS.full
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

  it("uses a static final state for reduced and lite landing motion", () => {
    expect(shouldUseStaticLandingMotion({
      reducedMotion: false,
      motionTier: MOTION_TIERS.lite
    })).toBe(true);
    expect(shouldUseStaticLandingMotion({
      reducedMotion: true,
      motionTier: MOTION_TIERS.full
    })).toBe(true);
    expect(shouldUseStaticLandingMotion({
      reducedMotion: false,
      motionTier: MOTION_TIERS.full
    })).toBe(false);
  });
});
