import { describe, expect, it, vi } from "vitest";
import { isCompletedMentorQuestionnaire, requestMentorMatch } from "../../src/lib/mentorMatch.js";

describe("completed mentor questionnaire client boundary", () => {
  it("recognizes any non-empty completed answer set", () => {
    for (const interest of ["Engineering", "Business", "Biology", "Undecided or exploring"]) {
      expect(isCompletedMentorQuestionnaire({ academicInterests: [interest] })).toBe(true);
    }
    expect(isCompletedMentorQuestionnaire({})).toBe(false);
  });

  it("requests a mentor summary for non-math interests", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ summary: "A structured engineering mentor would fit this student." })
      });
      await expect(requestMentorMatch({ academicInterests: ["Engineering"] })).resolves.toMatchObject({
        summary: expect.stringMatching(/engineering mentor/i)
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not request AI without questionnaire answers", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn();
      await expect(requestMentorMatch({})).resolves.toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
