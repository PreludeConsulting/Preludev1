import { hasMatchingTeamAccess } from "../../shared/matchingTeamAccess.js";
import {
  FINAL_MENTOR_MATCH_STATUSES,
  deriveMatchingDirectoryStatus,
  isStudentVisibleOnMatchingDirectory
} from "../../shared/matchingQueueEligibility.js";
import { deactivateStudentMentorChats, syncAssignedMentorStudentChat } from "./mentorAssignmentChat.js";

const FINAL_MATCH_STATUSES = [...FINAL_MENTOR_MATCH_STATUSES];

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function config(context) {
  return {
    url: context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL || "",
    anonKey: context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    serviceRoleKey: context.env?.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}

function runtimeFetch(context) {
  return context.fetch || fetch;
}

function matchingTeamEmails(context) {
  return [
    context.env?.PRELUDE_MATCHING_TEAM_EMAILS,
    context.env?.MATCHING_TEAM_EMAILS,
    context.env?.ADMIN_EMAIL_WHITELIST
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function supabaseRequest(context, path, { token, key, method = "GET", body, prefer } = {}) {
  const { url } = config(context);
  const response = await runtimeFetch(context)(`${url.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  const payload = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  })();
  if (!response.ok) {
    throw Object.assign(new Error(payload?.message || payload?.hint || "Supabase request failed."), {
      status: response.status,
      code: payload?.code || "supabase_request_failed"
    });
  }
  return payload;
}

async function authorizeMatchingTeam(context) {
  const { url, anonKey } = config(context);
  const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw Object.assign(new Error("Authentication required."), { status: 401, code: "unauthorized" });
  if (!url || !anonKey) {
    throw Object.assign(new Error("Supabase authentication is not configured."), {
      status: 503,
      code: "matching_auth_unavailable"
    });
  }

  const user = await supabaseRequest(context, "/auth/v1/user", {
    token,
    key: anonKey
  });
  if (!user?.id) throw Object.assign(new Error("Authentication required."), { status: 401, code: "unauthorized" });

  const profiles = await supabaseRequest(
    context,
    `/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(user.id)}`,
    { token, key: anonKey }
  );
  const profile = profiles?.[0] || null;
  const email = String(user.email || "").trim().toLowerCase();
  if (!hasMatchingTeamAccess(profile) && !matchingTeamEmails(context).includes(email)) {
    throw Object.assign(new Error("Matching Team access required."), { status: 403, code: "forbidden" });
  }
  return { user, profile };
}

function requireAdminConfig(context) {
  const { url, serviceRoleKey } = config(context);
  if (!url || !serviceRoleKey) {
    console.info("[prelude-matching]", JSON.stringify({
      event: "queue_load",
      serviceRoleClientAvailable: false
    }));
    throw Object.assign(new Error("The Matching Team data service is not configured."), {
      status: 503,
      code: "matching_admin_client_unavailable"
    });
  }
  return { serviceRoleKey };
}

function adminRest(context, tableAndQuery, options = {}) {
  const { serviceRoleKey } = requireAdminConfig(context);
  return supabaseRequest(context, `/rest/v1/${tableAndQuery}`, {
    token: serviceRoleKey,
    key: serviceRoleKey,
    ...options
  });
}

function inFilter(values) {
  return `(${values.map((value) => String(value).replace(/[(),]/g, "")).join(",")})`;
}

function mapMentor(row) {
  const name = row.display_name || "Prelude mentor";
  return {
    id: row.mentor_user_id,
    name,
    school: row.college || "College mentor",
    university: row.college || "College mentor",
    major: row.major || "Admissions mentor",
    matchPercent: 88,
    tags: Array.isArray(row.specialties) ? row.specialties.slice(0, 3) : [],
    specialties: row.specialties || [],
    targetMajors: row.target_majors || [],
    targetSchools: row.target_schools || [],
    supportStyles: row.support_styles || [],
    applicationStrengths: row.application_strengths || [],
    availability: row.availability || "Availability shared after matching",
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M",
    bio: row.bio || "",
    completed: Boolean(row.completed),
    source: "supabase"
  };
}

function matchStatus(row, { hasFinalMentorMatch = false } = {}) {
  return deriveMatchingDirectoryStatus(row, { hasFinalMentorMatch });
}

async function loadQueue(context) {
  requireAdminConfig(context);
  // Directory includes needs-review and already-assigned students so Matching Team
  // can reassign without losing the row after the first assignment.
  const rows = await adminRest(
    context,
    "onboarding_progress?select=user_id,questionnaire_answers,matched_mentor_ids,matched_mentor_count,admin_review_required,mentor_assignment_status,mentor_selection_method,selected_mentor_id,mentor_selection_timestamp,updated_at&or=(admin_review_required.eq.true,mentor_assignment_status.in.(admin_assigned,student_selected),selected_mentor_id.not.is.null)&order=mentor_selection_timestamp.desc.nullslast"
  ) || [];
  const userIds = rows.map((row) => row.user_id).filter(Boolean);
  const [profiles, finalMatches, mentorRows] = await Promise.all([
    userIds.length
      ? adminRest(context, `profiles?select=id,full_name,role&id=in.${inFilter(userIds)}`)
      : [],
    userIds.length
      ? adminRest(
        context,
        `mentor_matches?select=user_id,student_id,mentor_id,mentor_name,status&or=(user_id.in.${inFilter(userIds)},student_id.in.${inFilter(userIds)})&status=in.${inFilter(FINAL_MATCH_STATUSES)}`
      )
      : [],
    adminRest(context, "mentor_matching_profiles?select=*&completed=eq.true&order=display_name.asc")
  ]);

  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const assignmentByStudentId = new Map();
  for (const match of finalMatches || []) {
    const studentKey = match.student_id || match.user_id;
    if (!studentKey) continue;
    // Prefer the most recently seen active assignment row.
    if (!assignmentByStudentId.has(studentKey)) {
      assignmentByStudentId.set(studentKey, match);
    }
  }
  const eligibleRows = rows.filter((row) => isStudentVisibleOnMatchingDirectory({
    onboarding: row,
    profile: profileById[row.user_id]
  }));

  console.info("[prelude-matching]", JSON.stringify({
    event: "queue_load",
    serviceRoleClientAvailable: true,
    onboardingRows: rows.length,
    profileRows: (profiles || []).length,
    finalAssignments: assignmentByStudentId.size,
    eligibleStudents: eligibleRows.length
  }));

  return {
    students: eligibleRows.map((row) => {
      const assignment = assignmentByStudentId.get(row.user_id) || null;
      const selectedMentorId = row.selected_mentor_id || assignment?.mentor_id || null;
      return {
        studentId: row.user_id,
        studentName: profileById[row.user_id]?.full_name || "Student",
        questionnaireAnswers: row.questionnaire_answers || {},
        matchedMentorIds: row.matched_mentor_ids || [],
        matchedMentorCount: row.matched_mentor_count ?? (row.matched_mentor_ids || []).length,
        adminReviewRequired: Boolean(row.admin_review_required),
        mentorAssignmentStatus: row.mentor_assignment_status,
        mentorSelectionMethod: row.mentor_selection_method,
        matchStatus: matchStatus(row, { hasFinalMentorMatch: Boolean(assignment) }),
        selectedMentorId,
        assignedMentorId: assignment?.mentor_id || selectedMentorId || null,
        assignedMentorName: assignment?.mentor_name || null,
        selectionTimestamp: row.mentor_selection_timestamp,
        updatedAt: row.updated_at
      };
    }),
    mentors: (mentorRows || []).map(mapMentor).filter((mentor) => mentor.id)
  };
}

async function assignMentor(context, studentId) {
  requireAdminConfig(context);
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    throw Object.assign(new Error("Invalid request body."), { status: 400, code: "validation_error" });
  }
  const mentorId = String(payload?.mentorId || "").trim();
  if (!mentorId) throw Object.assign(new Error("Select a mentor."), { status: 400, code: "validation_error" });
  const mentors = await adminRest(
    context,
    `mentor_matching_profiles?select=*&mentor_user_id=eq.${encodeURIComponent(mentorId)}&limit=1`
  );
  const mentor = mentors?.[0];
  if (!mentor) throw Object.assign(new Error("Mentor profile not found."), { status: 404, code: "mentor_not_found" });
  const now = new Date().toISOString();
  await adminRest(context, `onboarding_progress?user_id=eq.${encodeURIComponent(studentId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      selected_mentor_id: mentorId,
      suggested_mentor_id: mentorId,
      mentor_assignment_status: "admin_assigned",
      admin_review_required: false,
      match_decision: "accepted",
      mentor_selection_timestamp: now,
      updated_at: now
    }
  });
  await adminRest(
    context,
    `mentor_matches?user_id=eq.${encodeURIComponent(studentId)}&status=in.(${FINAL_MATCH_STATUSES.join(",")})`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  await adminRest(
    context,
    `mentor_matches?student_id=eq.${encodeURIComponent(studentId)}&status=in.(${FINAL_MATCH_STATUSES.join(",")})`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  await adminRest(context, "mentor_matches", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      user_id: studentId,
      student_id: studentId,
      mentor_id: mentorId,
      mentor_name: mentor.display_name || "Prelude mentor",
      mentor_college: mentor.college || null,
      mentor_major: mentor.major || null,
      expertise: mentor.specialties || [],
      availability: mentor.availability || null,
      status: "assigned",
      notes: "Assigned by Prelude Matching Team after questionnaire review."
    }
  });

  try {
    await syncAssignedMentorStudentChat(context, { studentId, mentorId });
  } catch (chatError) {
    // Roll back the assignment if messaging setup fails so the pair stays consistent.
    console.error("[mentor-review] chat sync failed after assign", chatError?.message || chatError);
    await adminRest(
      context,
      `mentor_matches?user_id=eq.${encodeURIComponent(studentId)}&status=in.(${FINAL_MATCH_STATUSES.join(",")})`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    await adminRest(
      context,
      `mentor_matches?student_id=eq.${encodeURIComponent(studentId)}&status=in.(${FINAL_MATCH_STATUSES.join(",")})`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    await adminRest(context, `onboarding_progress?user_id=eq.${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        selected_mentor_id: null,
        suggested_mentor_id: null,
        mentor_assignment_status: null,
        admin_review_required: true,
        match_decision: null,
        updated_at: now
      }
    });
    throw Object.assign(new Error("Mentor was assigned but messaging could not be set up. Retry the assignment."), {
      status: 500,
      code: "chat_sync_failed"
    });
  }

  return { studentId, selectedMentorId: mentorId, mentorAssignmentStatus: "admin_assigned" };
}

async function removeAssignment(context, studentId) {
  requireAdminConfig(context);
  const now = new Date().toISOString();
  await adminRest(context, `onboarding_progress?user_id=eq.${encodeURIComponent(studentId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      selected_mentor_id: null,
      suggested_mentor_id: null,
      mentor_assignment_status: null,
      admin_review_required: true,
      match_decision: null,
      updated_at: now
    }
  });
  await adminRest(
    context,
    `mentor_matches?user_id=eq.${encodeURIComponent(studentId)}&status=in.(${FINAL_MATCH_STATUSES.join(",")})`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  await adminRest(
    context,
    `mentor_matches?student_id=eq.${encodeURIComponent(studentId)}&status=in.(${FINAL_MATCH_STATUSES.join(",")})`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  await deactivateStudentMentorChats(context, { studentId });
  return { studentId, selectedMentorId: null, mentorAssignmentStatus: null, matchStatus: "needs_review" };
}

export async function handleMentorReview(context, action, studentId = "") {
  try {
    await authorizeMatchingTeam(context);
    if (action === "access") return json({ allowed: true, teamName: "Matching Team" });
    if (action === "list") return json(await loadQueue(context));
    if (action === "assign" && context.request.method === "POST") {
      return json(await assignMentor(context, studentId));
    }
    if (action === "assign" && context.request.method === "DELETE") {
      return json(await removeAssignment(context, studentId));
    }
    return json({ error: "not_found", message: "Route not found." }, 404);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500 && error.code !== "matching_admin_client_unavailable") {
      console.error("[prelude-matching]", JSON.stringify({
        event: "request_failed",
        status,
        code: error.code || "server_error"
      }));
    }
    return json({
      error: error.code || (status >= 500 ? "server_error" : "request_failed"),
      message: error.message || "Request failed."
    }, status);
  }
}
