import { describe, expect, it } from "vitest";
import {
  CINEMATIC_EASE,
  CINEMATIC_LABELS,
  CINEMATIC_LOOP_BRIDGE_AT_MS,
  CINEMATIC_LOOP_BRIDGE_MS,
  CINEMATIC_LOOP_RESUME_AT_MS,
  CINEMATIC_TIMES,
  CINEMATIC_TIMES_MOBILE,
  CINEMATIC_WORDMARK_SPRING,
  PRELUDE_MATCH_CINEMATIC_DURATION_MS,
  PRELUDE_MATCH_CINEMATIC_DURATION_MS_MOBILE,
  buildPreludeMatchCinematicTimeline,
  getCinematicDurationMs
} from "../src/lib/preludeMatchCinematicMotion.js";

describe("preludeMatchCinematicMotion", () => {
  it("targets a 24 second looping cinematic with expo ease and spring wordmark", () => {
    expect(PRELUDE_MATCH_CINEMATIC_DURATION_MS).toBe(24000);
    expect(typeof CINEMATIC_EASE).toBe("function");
    expect(typeof CINEMATIC_WORDMARK_SPRING).toBe("object");
    expect(CINEMATIC_LOOP_BRIDGE_AT_MS + CINEMATIC_LOOP_BRIDGE_MS).toBe(
      PRELUDE_MATCH_CINEMATIC_DURATION_MS
    );
    expect(CINEMATIC_LOOP_RESUME_AT_MS).toBe(700);
  });

  it("defines labeled beat anchors in chronological order", () => {
    const starts = [
      CINEMATIC_TIMES.opener,
      CINEMATIC_TIMES.mentorReveal,
      CINEMATIC_TIMES.progressShow,
      CINEMATIC_TIMES.progressFill,
      CINEMATIC_TIMES.tasksEnter,
      CINEMATIC_TIMES.meetingEnter,
      CINEMATIC_TIMES.coinsEnter,
      CINEMATIC_TIMES.groupExit,
      CINEMATIC_TIMES.wordmark,
      CINEMATIC_TIMES.loopBridge
    ];
    const sorted = [...starts].sort((a, b) => a - b);
    expect(sorted[0]).toBe(0);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]).toBeGreaterThan(sorted[i - 1]);
    }
    expect(CINEMATIC_LABELS.wordmark).toBe("wordmark");
  });

  it("defines integrated assembly beats with tasks, meeting, and coins on desktop", () => {
    expect(CINEMATIC_TIMES.tasksEnter).toBeTruthy();
    expect(CINEMATIC_TIMES.meetingEnter).toBeTruthy();
    expect(CINEMATIC_TIMES.coinsEnter).toBeTruthy();
    expect(CINEMATIC_TIMES.end).toBe(24000);
  });

  it("omits coins layer on mobile timeline config", () => {
    expect(CINEMATIC_TIMES_MOBILE.coinsEnter).toBeNull();
    expect(CINEMATIC_TIMES_MOBILE.meetingEnter).toBeTruthy();
    expect(getCinematicDurationMs(true)).toBe(PRELUDE_MATCH_CINEMATIC_DURATION_MS_MOBILE);
  });

  it("exports a timeline builder function", () => {
    expect(typeof buildPreludeMatchCinematicTimeline).toBe("function");
  });
});
