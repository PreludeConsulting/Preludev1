import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  MENTOR_ASSIGNMENT_STATUS,
  MENTOR_SELECTION_METHOD,
  effectiveMatchedMentorCount,
  resolveMentorSelection
} from "../shared/mentorSelectionLogic.js";
import { hasMatchingTeamAccess } from "../shared/matchingTeamAccess.js";
import {
  FINAL_MENTOR_MATCH_STATUSES,
  deriveMatchingDirectoryStatus,
  hasSubmittedMatchingQuestionnaire,
  isStudentEligibleForMatchingQueue,
  isStudentVisibleOnMatchingDirectory
} from "../shared/matchingQueueEligibility.js";
import { readJsonBody, sendJson } from "./http.js";
import { withApiRateLimit } from "./lib/apiRateLimitMiddleware.js";
import {
  deactivateStudentMentorChats,
  syncAssignedMentorStudentChat
} from "./lib/mentorAssignmentChat.js";

function initialsFor(name) {
  return (
    String(name || "Mentor")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

function mapMentorRow(row, score = null, reasons = []) {
  if (!row) return null;
  const specialties = Array.isArray(row.specialties) ? row.specialties : [];
  const targetMajors = Array.isArray(row.target_majors) ? row.target_majors : [];
  const targetSchools = Array.isArray(row.target_schools) ? row.target_schools : [];
  const supportStyles = Array.isArray(row.support_styles) ? row.support_styles : [];
  const applicationStrengths = Array.isArray(row.application_strengths) ? row.application_strengths : [];
  return {
    id: row.mentor_user_id,
    name: row.display_name || "Prelude mentor",
    school: row.college || "College mentor",
    university: row.college || "College mentor",
    major: row.major || "Admissions mentor",
    matchPercent: score ?? 88,
    tags: specialties.slice(0, 3),
    specialties,
    targetMajors,
    targetSchools,
    supportStyles,
    applicationStrengths,
    reason: reasons[0] || row.bio || "Strong fit based on your questionnaire.",
    availability: row.availability || "Availability shared after matching",
    initials: initialsFor(row.display_name),
    bio: row.bio || "",
    completed: Boolean(row.completed),
    source: "supabase"
  };
}

function getSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey };
}

function getSupabaseAdmin(env = process.env) {
  const { url } = getSupabaseConfig(env);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function getSupabaseForUser(accessToken, env = process.env) {
  const { url, anonKey } = getSupabaseConfig(env);
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function requireSupabaseUser(req, env = process.env) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseForUser(token, env);
  if (!supabase) {
    const error = new Error("Supabase is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }
  return { supabase, user: data.user };
}

function matchingTeamEmails() {
  return [
    process.env.PRELUDE_MATCHING_TEAM_EMAILS,
    process.env.MATCHING_TEAM_EMAILS,
    process.env.ADMIN_EMAIL_WHITELIST
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isMatchingTeamProfile(profile, user) {
  if (hasMatchingTeamAccess(profile)) return true;
  const email = String(user?.email || "").trim().toLowerCase();
  return Boolean(email && matchingTeamEmails().includes(email));
}

async function requireMatchingTeam(req, env = process.env) {
  const { supabase, user } = await requireSupabaseUser(req, env);
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !isMatchingTeamProfile(profile, user)) {
    const authError = new Error("Matching Team access required.");
    authError.statusCode = 403;
    throw authError;
  }

  const adminClient = getSupabaseAdmin(env);
  return { supabase, adminClient, user, profile };
}

async function getMentorDisplay(supabase, mentorId) {
  const { data } = await supabase.from("mentor_matching_profiles").select("*").eq("mentor_user_id", mentorId).maybeSingle();
  return data ? mapMentorRow(data) : null;
}

function requireAdminWriter(adminClient) {
  if (!adminClient) {
    const error = new Error("Mentor assignment service is not configured.");
    error.statusCode = 503;
    error.code = "matching_admin_client_unavailable";
    throw error;
  }
  return adminClient;
}

async function assignMentorMatchRow(adminClient, { studentId, mentor, status, notes }) {
  // mentor_matches writes must use service role — never the caller's JWT.
  const supabase = requireAdminWriter(adminClient);
  // Replace any prior active/pending assignment so reassignment never duplicates.
  const replaceStatuses = [...FINAL_MENTOR_MATCH_STATUSES, "saved", "pending"];
  await supabase.from("mentor_matches").delete().eq("user_id", studentId).in("status", replaceStatuses);
  await supabase.from("mentor_matches").delete().eq("student_id", studentId).in("status", replaceStatuses);
  const { error } = await supabase.from("mentor_matches").insert({
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
  });
  if (error) throw error;
}

const selectionSchema = z.object({
  selectedMentorId: z.string().trim().min(1).nullable().optional()
});

const adminAssignSchema = z.object({
  mentorId: z.string().trim().min(1)
});

async function loadMentorCards(supabase, studentUserId, matchedIds = []) {
  if (!matchedIds.length) return [];
  const [{ data: rows }, { data: scores }] = await Promise.all([
    supabase.from("mentor_matching_profiles").select("*").in("mentor_user_id", matchedIds),
    supabase
      .from("mentor_match_scores")
      .select("mentor_user_id, score, reasons")
      .eq("student_user_id", studentUserId)
      .in("mentor_user_id", matchedIds)
  ]);
  const scoreById = Object.fromEntries((scores || []).map((entry) => [entry.mentor_user_id, entry]));
  return matchedIds
    .map((id) => {
      const row = (rows || []).find((entry) => entry.mentor_user_id === id);
      if (!row) return null;
      const scoreRow = scoreById[id];
      return mapMentorRow(row, scoreRow?.score ?? null, scoreRow?.reasons || []);
    })
    .filter(Boolean);
}

async function handleGetMentorSelection(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  const { data: onboarding, error } = await supabase.from("onboarding_progress").select("*").eq("user_id", user.id).maybeSingle();
  if (error) return sendJson(res, 500, { error: "load_failed", message: "Could not load mentor match state." });
  if (!onboarding?.mentor_matching_complete) {
    return sendJson(res, 404, { error: "not_ready", message: "Complete the PreludeMatch quiz first." });
  }

  const matchedIds = onboarding.matched_mentor_ids || [];
  const mentors = await loadMentorCards(supabase, user.id, matchedIds);

  return sendJson(res, 200, {
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

async function handleSaveMentorSelection(req, res) {
  const { supabase, user } = await requireSupabaseUser(req);
  const adminClient = getSupabaseAdmin();
  if (!adminClient) return matchingAdminUnavailable(res);
  const payload = selectionSchema.parse(await readJsonBody(req));

  const { data: onboarding, error: loadError } = await supabase
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadError) return sendJson(res, 500, { error: "load_failed", message: "Could not load mentor match state." });
  if (!onboarding?.mentor_matching_complete) {
    return sendJson(res, 400, { error: "not_ready", message: "Complete the PreludeMatch quiz first." });
  }
  if (onboarding.mentor_assignment_status) {
    return sendJson(res, 200, {
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
    selectedMentorId: payload.selectedMentorId ?? null
  });

  if (!resolved.ok) {
    return sendJson(res, 400, { error: resolved.error, message: resolved.message });
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

  // Entitlement columns + mentor_matches require service role after RLS hardening.
  const { data: updated, error: saveError } = await adminClient
    .from("onboarding_progress")
    .update(updatePayload)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (saveError) return sendJson(res, 500, { error: "save_failed", message: "Could not save mentor selection." });

  if (resolved.selectedMentorId) {
    const mentor = await getMentorDisplay(adminClient, resolved.selectedMentorId);
    if (mentor) {
      await assignMentorMatchRow(adminClient, {
        studentId: user.id,
        mentor,
        status: "assigned",
        notes: "Selected by student during PreludeMatch onboarding."
      });
      // Student self-selection creates the same conversation an admin assignment would.
      try {
        await syncAssignedMentorStudentChat(adminClient, {
          studentId: user.id,
          mentorId: resolved.selectedMentorId
        });
      } catch (chatError) {
        console.error("[mentor-selection] chat sync failed", chatError?.message || chatError);
      }
    }
  }

  return sendJson(res, 200, {
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

function getMatchStatus(row, { hasFinalMentorMatch = false } = {}) {
  return deriveMatchingDirectoryStatus(row, { hasFinalMentorMatch });
}

export {
  hasSubmittedMatchingQuestionnaire,
  isStudentEligibleForMatchingQueue,
  isStudentVisibleOnMatchingDirectory,
  FINAL_MENTOR_MATCH_STATUSES
};

async function loadCompletedMentors(supabase) {
  const { data, error } = await supabase
    .from("mentor_matching_profiles")
    .select("*")
    .eq("completed", true)
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => mapMentorRow(row)).filter(Boolean);
}

async function handleMatchingTeamAccess(req, res, env) {
  await requireMatchingTeam(req, env);
  return sendJson(res, 200, { allowed: true, teamName: "Matching Team" });
}

function matchingAdminUnavailable(res) {
  console.info("[prelude-matching]", JSON.stringify({
    event: "queue_load",
    serviceRoleClientAvailable: false
  }));
  return sendJson(res, 503, {
    error: "matching_admin_client_unavailable",
    message: "The Matching Team data service is not configured."
  });
}

async function handleAdminList(req, res, env) {
  const { adminClient: supabase } = await requireMatchingTeam(req, env);
  if (!supabase) {
    return matchingAdminUnavailable(res);
  }
  // Include needs-review and assigned students so reassignment stays possible.
  const { data: rows, error } = await supabase
    .from("onboarding_progress")
    .select("user_id, questionnaire_answers, matched_mentor_ids, matched_mentor_count, admin_review_required, mentor_assignment_status, mentor_selection_method, selected_mentor_id, mentor_selection_timestamp, updated_at")
    .or("admin_review_required.eq.true,mentor_assignment_status.in.(admin_assigned,student_selected),selected_mentor_id.not.is.null")
    .order("mentor_selection_timestamp", { ascending: false, nullsFirst: false });
  if (error) return sendJson(res, 500, { error: "load_failed", message: "Could not load mentor review queue." });

  const userIds = (rows || []).map((row) => row.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) {
    return sendJson(res, 500, { error: "load_failed", message: "Could not load student profiles for the mentor review queue." });
  }
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const [matchesByUser, matchesByStudent] = userIds.length
    ? await Promise.all([
      supabase
        .from("mentor_matches")
        .select("user_id, student_id, mentor_id, mentor_name, status")
        .in("user_id", userIds)
        .in("status", FINAL_MENTOR_MATCH_STATUSES),
      supabase
        .from("mentor_matches")
        .select("user_id, student_id, mentor_id, mentor_name, status")
        .in("student_id", userIds)
        .in("status", FINAL_MENTOR_MATCH_STATUSES)
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (matchesByUser.error || matchesByStudent.error) {
    return sendJson(res, 500, { error: "load_failed", message: "Could not verify final mentor assignments." });
  }
  const assignmentByStudentId = new Map();
  for (const match of [...(matchesByUser.data || []), ...(matchesByStudent.data || [])]) {
    const studentKey = match.student_id || match.user_id;
    if (!studentKey || assignmentByStudentId.has(studentKey)) continue;
    assignmentByStudentId.set(studentKey, match);
  }

  const eligibleRows = (rows || []).filter((row) => isStudentVisibleOnMatchingDirectory({
    onboarding: row,
    profile: profileById[row.user_id]
  }));

  console.info("[prelude-matching]", JSON.stringify({
    event: "queue_load",
    serviceRoleClientAvailable: true,
    onboardingRows: (rows || []).length,
    profileRows: (profiles || []).length,
    finalAssignments: assignmentByStudentId.size,
    eligibleStudents: eligibleRows.length
  }));

  const students = eligibleRows.map((row) => {
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
      matchStatus: getMatchStatus(row, { hasFinalMentorMatch: Boolean(assignment) }),
      selectedMentorId,
      assignedMentorId: assignment?.mentor_id || selectedMentorId || null,
      assignedMentorName: assignment?.mentor_name || null,
      selectionTimestamp: row.mentor_selection_timestamp,
      updatedAt: row.updated_at
    };
  });

  const mentors = await loadCompletedMentors(supabase);
  return sendJson(res, 200, { students, mentors });
}

async function handleAdminAssign(req, res, studentId, env) {
  const { adminClient: supabase } = await requireMatchingTeam(req, env);
  if (!supabase) return matchingAdminUnavailable(res);
  const payload = adminAssignSchema.parse(await readJsonBody(req));

  const { data: onboarding, error: loadError } = await supabase
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", studentId)
    .maybeSingle();
  if (loadError || !onboarding) {
    return sendJson(res, 404, { error: "not_found", message: "Student onboarding record not found." });
  }

  const mentor = await getMentorDisplay(supabase, payload.mentorId);
  if (!mentor) return sendJson(res, 404, { error: "mentor_not_found", message: "Mentor profile not found." });

  const now = new Date().toISOString();
  const { error: saveError } = await supabase
    .from("onboarding_progress")
    .update({
      selected_mentor_id: payload.mentorId,
      suggested_mentor_id: payload.mentorId,
      mentor_assignment_status: MENTOR_ASSIGNMENT_STATUS.ADMIN_ASSIGNED,
      admin_review_required: false,
      match_decision: "accepted",
      mentor_selection_timestamp: now,
      updated_at: now
    })
    .eq("user_id", studentId);
  if (saveError) return sendJson(res, 500, { error: "save_failed", message: "Could not assign mentor." });

  await assignMentorMatchRow(supabase, {
    studentId,
    mentor,
    status: "assigned",
    notes: "Assigned by Prelude Matching Team after questionnaire review."
  });

  try {
    await syncAssignedMentorStudentChat(supabase, {
      studentId,
      mentorId: payload.mentorId
    });
  } catch (chatError) {
    console.error("[mentor-selection] chat sync failed after assign", chatError?.message || chatError);
    const replaceStatuses = [...FINAL_MENTOR_MATCH_STATUSES, "saved", "pending"];
    await supabase.from("mentor_matches").delete().eq("user_id", studentId).in("status", replaceStatuses);
    await supabase.from("mentor_matches").delete().eq("student_id", studentId).in("status", replaceStatuses);
    await supabase
      .from("onboarding_progress")
      .update({
        selected_mentor_id: null,
        suggested_mentor_id: null,
        mentor_assignment_status: null,
        admin_review_required: true,
        match_decision: null,
        updated_at: now
      })
      .eq("user_id", studentId);
    return sendJson(res, 500, {
      error: "chat_sync_failed",
      message: "Mentor was assigned but messaging could not be set up. Retry the assignment."
    });
  }

  return sendJson(res, 200, {
    studentId,
    selectedMentorId: payload.mentorId,
    mentorAssignmentStatus: MENTOR_ASSIGNMENT_STATUS.ADMIN_ASSIGNED,
    matchStatus: "assigned",
    assignedMentorName: mentor.name || null
  });
}

async function handleAdminRemoveAssign(req, res, studentId, env) {
  const { adminClient: supabase } = await requireMatchingTeam(req, env);
  if (!supabase) return matchingAdminUnavailable(res);

  const { data: onboarding, error: loadError } = await supabase
    .from("onboarding_progress")
    .select("user_id")
    .eq("user_id", studentId)
    .maybeSingle();
  if (loadError || !onboarding) {
    return sendJson(res, 404, { error: "not_found", message: "Student onboarding record not found." });
  }

  const now = new Date().toISOString();
  const { error: saveError } = await supabase
    .from("onboarding_progress")
    .update({
      selected_mentor_id: null,
      suggested_mentor_id: null,
      mentor_assignment_status: null,
      admin_review_required: true,
      match_decision: null,
      updated_at: now
    })
    .eq("user_id", studentId);
  if (saveError) return sendJson(res, 500, { error: "save_failed", message: "Could not remove mentor match." });

  const replaceStatuses = [...FINAL_MENTOR_MATCH_STATUSES, "saved", "pending"];
  const { error: deleteByUserError } = await supabase
    .from("mentor_matches")
    .delete()
    .eq("user_id", studentId)
    .in("status", replaceStatuses);
  if (deleteByUserError) return sendJson(res, 500, { error: "delete_failed", message: "Could not remove mentor match." });
  const { error: deleteByStudentError } = await supabase
    .from("mentor_matches")
    .delete()
    .eq("student_id", studentId)
    .in("status", replaceStatuses);
  if (deleteByStudentError) return sendJson(res, 500, { error: "delete_failed", message: "Could not remove mentor match." });

  await deactivateStudentMentorChats(supabase, { studentId });

  return sendJson(res, 200, {
    studentId,
    selectedMentorId: null,
    mentorAssignmentStatus: null,
    matchStatus: "needs_review"
  });
}

export function createOnboardingMentorSelectionMiddleware(env = process.env) {
  return async function onboardingMentorSelectionMiddleware(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    const isSelectionRoute = pathname === "/api/onboarding/mentor-selection";
    const isAdminAccess = pathname === "/api/admin/mentor-review/access";
    const isAdminList = pathname === "/api/admin/mentor-review";
    const isAdminAssign = pathname.startsWith("/api/admin/mentor-review/") && pathname.endsWith("/assign");

    if (!isSelectionRoute && !isAdminAccess && !isAdminList && !isAdminAssign) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      if (isSelectionRoute && req.method === "GET") return await handleGetMentorSelection(req, res);
      if (isSelectionRoute && req.method === "POST") return await handleSaveMentorSelection(req, res);
      if (isAdminAccess && req.method === "GET") return await handleMatchingTeamAccess(req, res, env);
      if (isAdminList && req.method === "GET") return await handleAdminList(req, res, env);
      if (isAdminAssign && req.method === "POST") {
        const studentId = pathname.split("/")[4];
        return await handleAdminAssign(req, res, studentId, env);
      }
      if (isAdminAssign && req.method === "DELETE") {
        const studentId = pathname.split("/")[4];
        return await handleAdminRemoveAssign(req, res, studentId, env);
      }
      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        console.error("[prelude-matching]", JSON.stringify({
          event: "request_failed",
          status: statusCode,
          code: error.code || "server_error"
        }));
      }
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createOnboardingMentorSelectionMiddleware();

function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}

const rateLimitedHandler = withApiRateLimit(handler);

export default rateLimitedHandler;

export function createOnboardingMentorSelectionHandler() {
  return rateLimitedHandler;
}
