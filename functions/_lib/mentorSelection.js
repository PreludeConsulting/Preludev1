/**
 * Student mentor selection (Cloudflare Pages Functions).
 * Auth via user JWT; entitlement + mentor_matches writes via service role.
 */

import {
  effectiveMatchedMentorCount,
  resolveMentorSelection
} from "../../shared/mentorSelectionLogic.js";
import { FINAL_MENTOR_MATCH_STATUSES } from "../../shared/matchingQueueEligibility.js";
import {
  adminRest,
  corsHeaders,
  errorResponse,
  first,
  handlePreflight,
  json,
  readJsonBody,
  requireUser,
  rest
} from "./http.js";
import { syncAssignedMentorStudentChat } from "./mentorAssignmentChat.js";

const FINAL_MATCH_STATUSES = [...FINAL_MENTOR_MATCH_STATUSES, "saved", "pending"];

function mapMentor(row, score = null, reasons = []) {
  if (!row) return null;
  const name = row.display_name || "Prelude mentor";
  const specialties = Array.isArray(row.specialties) ? row.specialties : [];
  return {
    id: row.mentor_user_id,
    name,
    school: row.college || "College mentor",
    university: row.college || "College mentor",
    major: row.major || "Admissions mentor",
    matchPercent: score ?? 88,
    tags: specialties.slice(0, 3),
    specialties,
    targetMajors: row.target_majors || [],
    targetSchools: row.target_schools || [],
    supportStyles: row.support_styles || [],
    applicationStrengths: row.application_strengths || [],
    reason: reasons[0] || row.bio || "Strong fit based on your questionnaire.",
    availability: row.availability || "Availability shared after matching",
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M",
    bio: row.bio || "",
    completed: Boolean(row.completed),
    source: "supabase"
  };
}

function inFilter(values) {
  return `(${values.map((value) => String(value).replace(/[(),]/g, "")).join(",")})`;
}

async function loadMentorCards(context, token, studentUserId, matchedIds = []) {
  if (!matchedIds.length) return [];
  const [rows, scores] = await Promise.all([
    rest(context, token, `mentor_matching_profiles?select=*&mentor_user_id=in.${inFilter(matchedIds)}`),
    rest(
      context,
      token,
      `mentor_match_scores?select=mentor_user_id,score,reasons&student_user_id=eq.${encodeURIComponent(studentUserId)}&mentor_user_id=in.${inFilter(matchedIds)}`
    )
  ]);
  const scoreById = Object.fromEntries((scores || []).map((entry) => [entry.mentor_user_id, entry]));
  return matchedIds
    .map((id) => {
      const row = (rows || []).find((entry) => entry.mentor_user_id === id);
      if (!row) return null;
      const scoreRow = scoreById[id];
      return mapMentor(row, scoreRow?.score ?? null, scoreRow?.reasons || []);
    })
    .filter(Boolean);
}

async function assignMentorMatchRow(context, { studentId, mentor, status, notes }) {
  const statusFilter = FINAL_MATCH_STATUSES.join(",");
  await adminRest(
    context,
    `mentor_matches?user_id=eq.${encodeURIComponent(studentId)}&status=in.(${statusFilter})`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
  await adminRest(
    context,
    `mentor_matches?student_id=eq.${encodeURIComponent(studentId)}&status=in.(${statusFilter})`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
  await adminRest(context, "mentor_matches", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: studentId,
      student_id: studentId,
      mentor_id: mentor?.id || null,
      mentor_name: mentor?.name || "Prelude mentor",
      mentor_college: mentor?.school || mentor?.university || null,
      mentor_major: mentor?.major || null,
      expertise: mentor?.tags || [],
      availability: mentor?.availability || null,
      status,
      notes: notes || mentor?.reason || null
    })
  });
}

async function handleGet(context, user, token) {
  const rows = await rest(
    context,
    token,
    `onboarding_progress?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const onboarding = first(rows);
  if (!onboarding?.mentor_matching_complete) {
    return json({ error: "not_ready", message: "Complete the PreludeMatch quiz first." }, 404);
  }

  const matchedIds = onboarding.matched_mentor_ids || [];
  const mentors = await loadMentorCards(context, token, user.id, matchedIds);

  return json({
    matchedMentorCount: effectiveMatchedMentorCount(onboarding.matched_mentor_count, matchedIds, mentors.length),
    matchedMentorIds: matchedIds,
    mentors,
    selectedMentorId: onboarding.selected_mentor_id || null,
    mentorSelectionMethod: onboarding.mentor_selection_method || null,
    mentorAssignmentStatus: onboarding.mentor_assignment_status || null,
    adminReviewRequired: Boolean(onboarding.admin_review_required),
    mentorSelectionComplete: Boolean(onboarding.mentor_assignment_status),
    selectionTimestamp: onboarding.mentor_selection_timestamp || null,
    preludeMatchCompleted: Boolean(onboarding.prelude_match_completed)
  });
}

async function handlePost(context, user, token) {
  const payload = await readJsonBody(context.request);
  const selectedMentorId =
    payload?.selectedMentorId === null || payload?.selectedMentorId === undefined
      ? null
      : String(payload.selectedMentorId || "").trim() || null;

  const rows = await rest(
    context,
    token,
    `onboarding_progress?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const onboarding = first(rows);
  if (!onboarding?.mentor_matching_complete) {
    return json({ error: "not_ready", message: "Complete the PreludeMatch quiz first." }, 400);
  }
  if (onboarding.mentor_assignment_status) {
    return json({
      alreadyComplete: true,
      selectedMentorId: onboarding.selected_mentor_id || null,
      mentorSelectionMethod: onboarding.mentor_selection_method,
      mentorAssignmentStatus: onboarding.mentor_assignment_status,
      adminReviewRequired: Boolean(onboarding.admin_review_required),
      matchedMentorCount: onboarding.matched_mentor_count,
      matchedMentorIds: onboarding.matched_mentor_ids || []
    });
  }

  const matchedIds = onboarding.matched_mentor_ids || [];
  const matchedCount = effectiveMatchedMentorCount(onboarding.matched_mentor_count, matchedIds);
  const resolved = resolveMentorSelection({
    matchedMentorIds: matchedIds,
    matchedMentorCount: matchedCount,
    selectedMentorId
  });
  if (!resolved.ok) {
    return json({ error: resolved.error, message: resolved.message }, 400);
  }

  const updatePayload = {
    selected_mentor_id: resolved.selectedMentorId,
    suggested_mentor_id: resolved.selectedMentorId || onboarding.suggested_mentor_id,
    mentor_selection_method: resolved.mentorSelectionMethod,
    mentor_assignment_status: resolved.mentorAssignmentStatus,
    admin_review_required: resolved.adminReviewRequired,
    mentor_selection_timestamp: resolved.selectionTimestamp,
    prelude_match_completed: true,
    match_decision: resolved.selectedMentorId ? "accepted" : null,
    updated_at: resolved.selectionTimestamp
  };

  const updatedRows = await adminRest(
    context,
    `onboarding_progress?user_id=eq.${encodeURIComponent(user.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updatePayload)
    }
  );
  const updated = first(updatedRows);

  if (resolved.selectedMentorId) {
    const mentorRows = await adminRest(
      context,
      `mentor_matching_profiles?select=*&mentor_user_id=eq.${encodeURIComponent(resolved.selectedMentorId)}&limit=1`
    );
    const mentor = mapMentor(first(mentorRows));
    if (mentor) {
      await assignMentorMatchRow(context, {
        studentId: user.id,
        mentor,
        status: "assigned",
        notes: "Selected by student during PreludeMatch onboarding."
      });
      try {
        await syncAssignedMentorStudentChat(context, {
          studentId: user.id,
          mentorId: resolved.selectedMentorId
        });
      } catch (chatError) {
        console.error("[mentor-selection] chat sync failed", chatError?.message || chatError);
      }
    }
  }

  return json({
    selectedMentorId: resolved.selectedMentorId,
    mentorSelectionMethod: resolved.mentorSelectionMethod,
    mentorAssignmentStatus: resolved.mentorAssignmentStatus,
    adminReviewRequired: resolved.adminReviewRequired,
    matchedMentorCount: resolved.matchedMentorCount,
    matchedMentorIds: resolved.matchedMentorIds,
    rejectedClientSelection: Boolean(resolved.rejectedClientSelection),
    onboarding: updated
  });
}

export async function handleMentorSelection(context) {
  const methods = "GET, POST, OPTIONS";
  if (context.request.method === "OPTIONS") return handlePreflight(context, { methods });
  if (context.request.method !== "GET" && context.request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { ...corsHeaders(context, { methods }), Allow: methods });
  }

  try {
    const { user, token } = await requireUser(context);
    if (context.request.method === "GET") return await handleGet(context, user, token);
    return await handlePost(context, user, token);
  } catch (error) {
    return errorResponse(error, { label: "prelude-mentor-selection" });
  }
}
