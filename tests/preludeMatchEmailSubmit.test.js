/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPreludeMatchSubmissionId,
  ensurePreludeMatchSubmissionId,
  readPreludeMatchSubmissionId,
  submitPreludeMatchByEmail
} from "../src/lib/preludeMatchSubmit.js";

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => globalThis.__preludeMatchSupabase
}));

afterEach(() => {
  clearPreludeMatchSubmissionId();
  globalThis.__preludeMatchSupabase = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it("posts to /api/prelude-match/submit and clears the attempt id only after success", async () => {
    const id = ensurePreludeMatchSubmissionId();
    globalThis.__preludeMatchSupabase = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "tok_test" } },
          error: null
        })
      }
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, submissionId: id, emailId: "email_1" })
    }));
    vi.stubGlobal("fetch", fetchMock);

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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prelude-match/submit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok_test"
        }),
        body: expect.stringContaining(id)
      })
    );
    expect(readPreludeMatchSubmissionId()).toBe("");
  });

  it("preserves the submission id when the provider rejects", async () => {
    const id = ensurePreludeMatchSubmissionId();
    globalThis.__preludeMatchSupabase = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "tok_test" } },
          error: null
        })
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({
          success: false,
          error: "We couldn’t submit your Prelude Match responses. Your answers are still here—please try again."
        })
      }))
    );

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
