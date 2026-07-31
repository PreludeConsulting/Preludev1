import { describe, expect, it, vi } from "vitest";
import { handleMentorReview } from "../functions/_lib/mentorReview.js";

const eligibleStudentId = "11111111-1111-4111-a111-111111111111";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function context(fetchMock, env = {}) {
  return {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "public-anon-key",
      ...env
    },
    request: new Request("https://prelude.test/api/admin/mentor-review", {
      headers: { Authorization: "Bearer requesting-user-token" }
    }),
    fetch: fetchMock
  };
}

function authorizedResponses(fetchMock) {
  fetchMock
    .mockResolvedValueOnce(response({ id: "admin-1", email: "admin@example.com" }))
    .mockResolvedValueOnce(response([{ id: "admin-1", role: "admin" }]));
}

describe("Cloudflare Matching Team queue", () => {
  it("uses the service role after authorization and returns the exact eligible student", async () => {
    const fetchMock = vi.fn();
    authorizedResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(response([{
        user_id: eligibleStudentId,
        questionnaire_answers: { grade: "College", academicInterests: ["Computer Science"] },
        matched_mentor_ids: [],
        matched_mentor_count: 0,
        admin_review_required: true,
        mentor_assignment_status: null,
        mentor_selection_method: null,
        selected_mentor_id: null,
        mentor_selection_timestamp: null,
        updated_at: "2026-07-31T00:00:00Z"
      }]))
      .mockResolvedValueOnce(response([{ id: eligibleStudentId, full_name: "Eligible Student", role: "student" }]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]));

    const result = await handleMentorReview(
      context(fetchMock, { SUPABASE_SERVICE_ROLE_KEY: "server-only-service-role" }),
      "list"
    );
    const payload = await result.json();

    expect(result.status).toBe(200);
    expect(payload.students).toHaveLength(1);
    expect(payload.students[0]).toMatchObject({
      studentId: eligibleStudentId,
      matchedMentorCount: 0,
      adminReviewRequired: true,
      matchStatus: "needs_review"
    });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer server-only-service-role");
  });

  it("returns 503 instead of allowing user-scoped RLS to masquerade as an empty queue", async () => {
    const fetchMock = vi.fn();
    authorizedResponses(fetchMock);

    const result = await handleMentorReview(context(fetchMock), "list");
    const payload = await result.json();

    expect(result.status).toBe(503);
    expect(payload).toEqual({
      error: "matching_admin_client_unavailable",
      message: "The Matching Team data service is not configured."
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("authorizes the requesting user before checking service-role availability", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ id: "user-1", email: "student@example.com" }))
      .mockResolvedValueOnce(response([{ id: "user-1", role: "student" }]));

    const result = await handleMentorReview(context(fetchMock), "list");

    expect(result.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an unauthenticated request before any Supabase data query", async () => {
    const fetchMock = vi.fn();
    const ctx = context(fetchMock, { SUPABASE_SERVICE_ROLE_KEY: "server-only-service-role" });
    ctx.request = new Request("https://prelude.test/api/admin/mentor-review");

    const result = await handleMentorReview(ctx, "list");

    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("excludes a student with a final assignment", async () => {
    const fetchMock = vi.fn();
    authorizedResponses(fetchMock);
    fetchMock
      .mockResolvedValueOnce(response([{
        user_id: eligibleStudentId,
        questionnaire_answers: { grade: "College" },
        matched_mentor_ids: [],
        matched_mentor_count: 0,
        admin_review_required: true,
        mentor_assignment_status: null
      }]))
      .mockResolvedValueOnce(response([{ id: eligibleStudentId, full_name: "Assigned Student", role: "student" }]))
      .mockResolvedValueOnce(response([{ user_id: eligibleStudentId, student_id: eligibleStudentId, status: "assigned" }]))
      .mockResolvedValueOnce(response([]));

    const result = await handleMentorReview(
      context(fetchMock, { SUPABASE_SERVICE_ROLE_KEY: "server-only-service-role" }),
      "list"
    );

    expect((await result.json()).students).toEqual([]);
  });
});
