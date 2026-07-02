import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  MENTOR_ASSIGNMENT_STATUS,
  MENTOR_SELECTION_METHOD,
  effectiveMatchedMentorCount,
  resolveMentorSelection
} from "../shared/mentorSelectionLogic.js";
import { readJsonBody, sendJson } from "./http.js";

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

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey };
}

function getSupabaseAdmin() {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function getSupabaseForUser(accessToken) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function requireSupabaseUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseForUser(token);
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
  if (profile?.role === "admin") return true;
  const email = String(user?.email || "").trim().toLowerCase();
  return Boolean(email && matchingTeamEmails().includes(email));
}

async function requireMatchingTeam(req) {
  const { supabase, user } = await requireSupabaseUser(req);
  const { data: profile, error } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (error || !isMatchingTeamProfile(profile, user)) {
    const authError = new Error("Matching Team access required.");
    authError.statusCode = 403;
    throw authError;
  }

  const adminClient = getSupabaseAdmin() || supabase;
  return { supabase: adminClient, user, profile };
}

async function getMentorDisplay(supabase, mentorId) {
  const { data } = await supabase.from("mentor_matching_profiles").select("*").eq("mentor_user_id", mentorId).maybeSingle();
  return data ? mapMentorRow(data) : null;
}

async function assignMentorMatchRow(supabase, { studentId, mentor, status, notes }) {
  await supabase.from("mentor_matches").delete().eq("user_id", studentId).in("status", ["assigned", "saved", "pending"]);
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

  const { data: updated, error: saveError } = await supabase
    .from("onboarding_progress")
    .update(updatePayload)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (saveError) return sendJson(res, 500, { error: "save_failed", message: "Could not save mentor selection." });

  if (resolved.selectedMentorId) {
    const mentor = await getMentorDisplay(supabase, resolved.selectedMentorId);
    if (mentor) {
      await assignMentorMatchRow(supabase, {
        studentId: user.id,
        mentor,
        status: "assigned",
        notes: "Selected by student during PreludeMatch onboarding."
      });
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

function getMatchStatus(row) {
  if (row.admin_review_required) return "needs_review";
  if (
    row.selected_mentor_id
    || row.mentor_assignment_status === MENTOR_ASSIGNMENT_STATUS.ADMIN_ASSIGNED
    || row.mentor_assignment_status === MENTOR_ASSIGNMENT_STATUS.STUDENT_SELECTED
  ) return "matched";
  return "unmatched";
}

async function loadCompletedMentors(supabase) {
  const { data, error } = await supabase
    .from("mentor_matching_profiles")
    .select("*")
    .eq("completed", true)
    .order("display_name", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => mapMentorRow(row)).filter(Boolean);
}

async function handleMatchingTeamAccess(req, res) {
  await requireMatchingTeam(req);
  return sendJson(res, 200, { allowed: true, teamName: "Matching Team" });
}

async function handleAdminList(req, res) {
  const { supabase } = await requireMatchingTeam(req);
  const { data: rows, error } = await supabase
    .from("onboarding_progress")
    .select("user_id, questionnaire_answers, matched_mentor_ids, matched_mentor_count, admin_review_required, mentor_assignment_status, mentor_selection_method, selected_mentor_id, mentor_selection_timestamp, updated_at")
    .not("questionnaire_answers", "is", null)
    .order("mentor_selection_timestamp", { ascending: false, nullsFirst: false });
  if (error) return sendJson(res, 500, { error: "load_failed", message: "Could not load mentor review queue." });

  const userIds = (rows || []).map((row) => row.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", userIds)
    : { data: [] };
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const students = (rows || []).map((row) => ({
    studentId: row.user_id,
    studentName: profileById[row.user_id]?.full_name || "Student",
    questionnaireAnswers: row.questionnaire_answers || {},
    matchedMentorIds: row.matched_mentor_ids || [],
    matchedMentorCount: row.matched_mentor_count ?? (row.matched_mentor_ids || []).length,
    adminReviewRequired: Boolean(row.admin_review_required),
    mentorAssignmentStatus: row.mentor_assignment_status,
    mentorSelectionMethod: row.mentor_selection_method,
    matchStatus: getMatchStatus(row),
    selectedMentorId: row.selected_mentor_id,
    selectionTimestamp: row.mentor_selection_timestamp,
    updatedAt: row.updated_at
  }));

  const mentors = await loadCompletedMentors(supabase);
  return sendJson(res, 200, { students, mentors });
}

async function handleAdminAssign(req, res, studentId) {
  const { supabase } = await requireMatchingTeam(req);
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

  return sendJson(res, 200, {
    studentId,
    selectedMentorId: payload.mentorId,
    mentorAssignmentStatus: MENTOR_ASSIGNMENT_STATUS.ADMIN_ASSIGNED
  });
}

async function handleAdminRemoveAssign(req, res, studentId) {
  const { supabase } = await requireMatchingTeam(req);

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

  const { error: deleteError } = await supabase
    .from("mentor_matches")
    .delete()
    .eq("user_id", studentId)
    .in("status", ["assigned", "saved", "pending"]);
  if (deleteError) return sendJson(res, 500, { error: "delete_failed", message: "Could not remove mentor match." });

  return sendJson(res, 200, {
    studentId,
    selectedMentorId: null,
    mentorAssignmentStatus: null,
    matchStatus: "needs_review"
  });
}

export function createOnboardingMentorSelectionMiddleware() {
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
      if (isAdminAccess && req.method === "GET") return await handleMatchingTeamAccess(req, res);
      if (isAdminList && req.method === "GET") return await handleAdminList(req, res);
      if (isAdminAssign && req.method === "POST") {
        const studentId = pathname.split("/")[4];
        return await handleAdminAssign(req, res, studentId);
      }
      if (isAdminAssign && req.method === "DELETE") {
        const studentId = pathname.split("/")[4];
        return await handleAdminRemoveAssign(req, res, studentId);
      }
      return sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof z.ZodError) return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-mentor-selection]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createOnboardingMentorSelectionMiddleware();

export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}

export function createOnboardingMentorSelectionHandler() {
  return handler;
}
