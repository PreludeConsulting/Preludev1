/**
 * Supabase profile helpers.
 */

import { getSupabase } from "./supabase.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export function mapProfileRow(row, email) {
  if (!row) return null;
  const majors = Array.isArray(row.target_majors) ? row.target_majors : [];
  const mentorPreferences = row.mentor_preferences || {};
  const extracurricularActivities = Array.isArray(mentorPreferences.extracurricularEntries)
    ? mentorPreferences.extracurricularEntries
    : [];
  const awardsEntries = Array.isArray(mentorPreferences.awardsEntries) ? mentorPreferences.awardsEntries : [];
  const leadershipEntries = Array.isArray(mentorPreferences.leadershipEntries)
    ? mentorPreferences.leadershipEntries
    : [];
  const volunteerEntries = Array.isArray(mentorPreferences.volunteerEntries)
    ? mentorPreferences.volunteerEntries
    : [];
  const workEntries = Array.isArray(mentorPreferences.workEntries) ? mentorPreferences.workEntries : [];

  return {
    grade: row.grade_level,
    graduationYear: row.graduation_year,
    gpa: row.gpa,
    gpaScale: mentorPreferences.gpaScale || "/4.00",
    weightedGpa: row.weighted_gpa,
    sat: row.sat,
    act: row.act ?? mentorPreferences.act ?? null,
    bio: row.bio,
    academicGoals: row.academic_goals,
    collegeInterests: Array.isArray(row.college_interests) ? row.college_interests : [],
    mentorPreferences,
    locationPreferences: mentorPreferences.location || "",
    collegeSizePreferences: mentorPreferences.size || "",
    financialAidNotes: mentorPreferences.budget || "",
    activities: mentorPreferences.activities || "",
    awards: awardsEntries.length ? awardsEntries : (mentorPreferences.awards || ""),
    leadershipRoles: mentorPreferences.leadershipRoles || "",
    volunteerWork: mentorPreferences.volunteerWork || "",
    workExperience: workEntries.length ? workEntries : (mentorPreferences.workExperience || ""),
    extracurricularActivities,
    leadership: leadershipEntries,
    volunteerExperience: volunteerEntries,
    targetMajors: majors,
    majors,
    colleges: Array.isArray(row.college_interests) ? row.college_interests : [],
    school: row.school,
    email: row.email || email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role
  };
}

export async function getMyProfile(userId, email) {
  if (!userId) return { profile: null, error: "You must be signed in." };
  const { data, error } = await db().from("profiles").select("*").eq("id", userId).maybeSingle();
  return { profile: mapProfileRow(data, email), error: error?.message || null };
}

export async function updateMyProfile(userId, fields) {
  if (!userId) return { profile: null, error: "You must be signed in." };

  const payload = { updated_at: new Date().toISOString() };
  if (fields.fullName !== undefined) payload.full_name = fields.fullName;
  if (fields.school !== undefined) payload.school = fields.school;
  if (fields.gradeLevel !== undefined) payload.grade_level = fields.gradeLevel;
  if (fields.bio !== undefined) payload.bio = fields.bio;
  if (fields.academicGoals !== undefined) payload.academic_goals = fields.academicGoals;
  if (fields.collegeInterests !== undefined) payload.college_interests = fields.collegeInterests;
  if (fields.mentorPreferences !== undefined) payload.mentor_preferences = fields.mentorPreferences;
  if (fields.graduationYear !== undefined) payload.graduation_year = fields.graduationYear;
  if (fields.gpa !== undefined) payload.gpa = fields.gpa;
  if (fields.weightedGpa !== undefined) payload.weighted_gpa = fields.weightedGpa;
  if (fields.sat !== undefined) payload.sat = fields.sat;
  if (fields.act !== undefined) payload.act = fields.act;
  if (fields.targetMajors !== undefined) payload.target_majors = fields.targetMajors;
  if (fields.avatarUrl !== undefined) payload.avatar_url = fields.avatarUrl;

  const { data, error } = await db().from("profiles").update(payload).eq("id", userId).select().maybeSingle();
  return { profile: data, error: error?.message || null };
}
