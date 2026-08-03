/** @vitest-environment happy-dom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPreludeMatchSubmissionId,
  ensurePreludeMatchSubmissionId,
  readPreludeMatchSubmissionId,
  submitPreludeMatchByEmail
} from "../src/lib/preludeMatchSubmit.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => globalThis.__preludeMatchSupabase
}));

afterEach(() => {
  clearPreludeMatchSubmissionId();
  globalThis.__preludeMatchSupabase = null;
  vi.restoreAllMocks();
});

describe("preludeMatchSubmit client behavior", () => {
  it("reuses one submission ID across retries and only stores the id in sessionStorage", () => {
    const first = ensurePreludeMatchSubmissionId();
    const second = ensurePreludeMatchSubmissionId();
    expect(first).toBe(second);
    expect(readPreludeMatchSubmissionId()).toBe(first);
    expect(sessionStorage.getItem("prelude_match_submission_attempt_id")).toBe(first);
    expect(sessionStorage.getItem("prelude_match_answers")).toBeNull();
    expect(Object.keys(sessionStorage).every((key) => !/answer|questionnaire|payload/i.test(key))).toBe(true);
  });

  it("invokes send-prelude-match and clears the attempt id only after success", async () => {
    const invoke = vi.fn(async () => ({ data: { success: true, submissionId: "x" }, error: null }));
    globalThis.__preludeMatchSupabase = { functions: { invoke } };
    const id = ensurePreludeMatchSubmissionId();

    const result = await submitPreludeMatchByEmail(
      {
        grade: "11th grade",
        processStage: ["Building my college list"],
        helpAreas: ["Choosing colleges"],
        academicInterests: ["Computer science"],
        colleges: [{ id: "harvard", name: "Harvard University", city: "Cambridge", state: "MA" }],
        mentorQualities: ["Structured step-by-step guidance"],
        structureScale: 3,
        accomplishFirst: ["Build my college list"]
      },
      { studentDisplayName: "Ada" }
    );

    expect(result.success).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      "send-prelude-match",
      expect.objectContaining({
        body: expect.objectContaining({
          submissionId: id,
          answers: expect.objectContaining({
            colleges: { stillExploring: false, collegeIds: ["harvard"] }
          })
        })
      })
    );
    expect(readPreludeMatchSubmissionId()).toBe("");
  });

  it("preserves the submission id when the provider rejects", async () => {
    const invoke = vi.fn(async () => ({
      data: { success: false, error: "Email provider unavailable" },
      error: null
    }));
    globalThis.__preludeMatchSupabase = { functions: { invoke } };
    const id = ensurePreludeMatchSubmissionId();
    await expect(
      submitPreludeMatchByEmail({
        grade: "11th grade",
        processStage: ["Building my college list"],
        helpAreas: ["Choosing colleges"],
        academicInterests: ["Computer science"],
        colleges: ["Still exploring"],
        mentorQualities: ["Structured step-by-step guidance"],
        structureScale: 3,
        accomplishFirst: ["Build my college list"]
      })
    ).rejects.toThrow(/still here/i);
    expect(readPreludeMatchSubmissionId()).toBe(id);
  });
});
