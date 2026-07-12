/**
 * Supabase dashboard data — per-user CRUD keyed by auth.users.id.
 * Lower-level helpers live in dashboardData.js, profileData.js, messageData.js, calendarData.js.
 */

import { getCurrentUser, getMyCollegeList, getMyDeadlines, getMyEssayDrafts, getMyMentorMatches, getMyScholarships, getMySettings, getMyTasks, getMatchAnswers, mapMentorMatch, updateMySettings } from "./dashboardData.js";
import { getMyProfile, mapProfileRow, updateMyProfile } from "./profileData.js";
import { getMyMessages, mapMessage, sendMessage as sendSupabaseMessage } from "./messageData.js";
import {
  createCalendarEvent as createCalendarEventRow,
  deleteCalendarEvent as deleteCalendarEventRow,
  getMyCalendarEvents,
  mapCalendarEvent,
  updateCalendarEvent as updateCalendarEventRow
} from "./calendarData.js";
import { getSupabase } from "./supabase.js";

function db() {
  return getSupabase();
}

/** Turn PostgREST / Supabase load errors into actionable dashboard messages. */
export function formatDashboardPersistenceError(errors = []) {
  const messages = errors
    .map((entry) => (typeof entry === "string" ? entry : entry?.message))
    .filter(Boolean);

  if (messages.some((msg) => /onboarding_progress/i.test(msg))) {
    return "Profile progress could not be saved because the onboarding_progress table is missing. Run supabase/setup-dashboard-data.sql in the Supabase SQL Editor, then reload the page.";
  }

  if (messages.some((msg) => /user_settings/i.test(msg))) {
    return "Dashboard settings could not be loaded because the user_settings table is missing. Run supabase/setup-dashboard-data.sql in the Supabase SQL Editor, then reload the page.";
  }

  if (messages.length && import.meta.env.DEV) console.error("[prelude-dashboard-sync]", messages);
  return "Some dashboard data is temporarily unavailable. Refresh to retry.";
}

function mapPreferences(row) {
  if (!row) return null;
  return {
    emailUpdates: row.email_updates,
    meetingReminders: row.meeting_reminders,
    mentorMessages: row.mentor_messages,
    studentMessages: row.student_messages,
    deadlineReminders: row.deadline_reminders,
    progressReminders: row.progress_reminders,
    rewardUpdates: row.reward_updates,
    essayComments: row.essay_comments,
    collegeApplicationUpdates: row.college_application_updates,
    scholarshipReminders: row.scholarship_reminders,
    parentSummaries: row.parent_summaries,
    notificationSounds: row.notification_sounds,
    interfaceSounds: row.interface_sounds,
    weeklyDigest: row.weekly_digest,
    digestFrequency: row.digest_frequency,
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    productTips: row.product_tips,
    defaultCalendarView: row.default_calendar_view,
    reminderLeadTime: row.reminder_lead_time,
    weekStart: row.week_start,
    density: row.density,
    reduceMotion: row.reduce_motion,
    hapticFeedback: row.haptic_feedback,
    profileVisibility: row.profile_visibility,
    theme: row.theme,
    dataExportRequestedAt: row.data_export_requested_at
  };
}

function mapOnboarding(row) {
  if (!row) return { profileComplete: 0, mentorMatchingStarted: false, mentorMatchingComplete: false, questionnaireAnswers: {} };
  return {
    profileComplete: row.profile_complete ?? 0,
    mentorMatchingStarted: row.mentor_matching_started,
    mentorMatchingComplete: row.mentor_matching_complete,
    questionnaireAnswers: row.questionnaire_answers || {},
    onboardingStatus: row.onboarding_status || null,
    suggestedMentorId: row.suggested_mentor_id || null,
    matchDecision: row.match_decision || null,
    declinedMentorIds: row.declined_mentor_ids || [],
    mentorSelectionComplete: Boolean(row.mentor_assignment_status),
    matchedMentorCount: row.matched_mentor_count ?? (row.matched_mentor_ids || []).length,
    matchedMentorIds: row.matched_mentor_ids || [],
    selectedMentorId: row.selected_mentor_id || null,
    mentorSelectionMethod: row.mentor_selection_method || null,
    mentorAssignmentStatus: row.mentor_assignment_status || null,
    adminReviewRequired: Boolean(row.admin_review_required)
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    unread: row.unread,
    link: row.link,
    createdAt: row.created_at
  };
}

function mapResource(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    url: row.url,
    savedAt: row.saved_at
  };
}

/** Load all dashboard data for the signed-in user. */
export async function loadSupabaseDashboard(userId, email) {
  const supabase = db();
  if (!supabase) throw new Error("Supabase is not configured.");

  const [
    profileRes,
    settingsRes,
    onboardingRes,
    mentorsRes,
    eventsRes,
    messagesRes,
    notificationsRes,
    resourcesRes,
    tasksRes,
    essaysRes,
    deadlinesRes,
    collegesRes,
    matchAnswersRes,
    scholarshipsRes
  ] = await Promise.all([
    getMyProfile(userId, email),
    getMySettings(userId),
    supabase.from("onboarding_progress").select("*").eq("user_id", userId).maybeSingle(),
    getMyMentorMatches(userId),
    getMyCalendarEvents(userId),
    getMyMessages(userId),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("saved_resources").select("*").eq("user_id", userId).order("saved_at", { ascending: false }),
    getMyTasks(userId),
    getMyEssayDrafts(userId),
    getMyDeadlines(userId),
    getMyCollegeList(userId),
    getMatchAnswers(userId),
    getMyScholarships(userId)
  ]);

  const mentors = mentorsRes.matches || [];
  const assigned = mentors.find((m) => m.status === "assigned") || mentors[0] || null;
  const events = eventsRes.events || [];
  const meetings = events.filter((e) => e.eventType === "meeting" || e.eventType === "session");
  const messages = messagesRes.messages || [];
  const onboardingRow = onboardingRes.data;
  const onboarding = mapOnboarding(onboardingRow);
  if (matchAnswersRes.answers && Object.keys(matchAnswersRes.answers).length) {
    onboarding.questionnaireAnswers = {
      ...onboarding.questionnaireAnswers,
      ...matchAnswersRes.answers
    };
  }

  return {
    profile: profileRes.profile,
    preferences: settingsRes.settings,
    onboarding,
    mentor: assigned,
    mentors,
    meetings,
    events,
    messages,
    tasks: tasksRes.tasks || [],
    essays: essaysRes.essays || [],
    deadlines: deadlinesRes.deadlines || [],
    scholarships: scholarshipsRes.scholarships || [],
    savedColleges: collegesRes.colleges || [],
    availability: [],
    conversations: messages.length
      ? [{ id: "mentor", name: assigned?.name || "Mentor", preview: messages[0]?.body, unread: messages.some((m) => !m.read) }]
      : [],
    notifications: (notificationsRes.data || []).map(mapNotification),
    savedResources: (resourcesRes.data || []).map(mapResource),
    errors: [
      profileRes.error,
      settingsRes.error,
      onboardingRes.error,
      mentorsRes.error,
      eventsRes.error,
      messagesRes.error,
      notificationsRes.error,
      resourcesRes.error,
      tasksRes.error,
      essaysRes.error,
      deadlinesRes.error,
      collegesRes.error,
      matchAnswersRes.error,
      scholarshipsRes.error
    ].filter(Boolean)
  };
}

export async function updateSupabaseProfile(userId, fields) {
  return updateMyProfile(userId, fields);
}

export async function updateSupabasePreferences(userId, prefs) {
  return updateMySettings(userId, prefs);
}

export async function updateSupabaseOnboarding(userId, fields) {
  const payload = { updated_at: new Date().toISOString() };
  if (fields.profileComplete !== undefined) payload.profile_complete = fields.profileComplete;
  if (fields.mentorMatchingStarted !== undefined) payload.mentor_matching_started = fields.mentorMatchingStarted;
  if (fields.mentorMatchingComplete !== undefined) payload.mentor_matching_complete = fields.mentorMatchingComplete;
  if (fields.questionnaireAnswers !== undefined) payload.questionnaire_answers = fields.questionnaireAnswers;
  if (fields.onboardingStatus !== undefined) payload.onboarding_status = fields.onboardingStatus;
  if (fields.suggestedMentorId !== undefined) payload.suggested_mentor_id = fields.suggestedMentorId;
  if (fields.matchDecision !== undefined) payload.match_decision = fields.matchDecision;
  if (fields.declinedMentorIds !== undefined) payload.declined_mentor_ids = fields.declinedMentorIds;

  const { data, error } = await db()
    .from("onboarding_progress")
    .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  return { onboarding: data, error: error?.message || null };
}

export async function createCalendarEvent(userId, event) {
  return createCalendarEventRow(userId, event);
}

export async function updateCalendarEvent(userId, eventId, event) {
  return updateCalendarEventRow(userId, eventId, event);
}

export async function deleteCalendarEvent(userId, eventId) {
  return deleteCalendarEventRow(userId, eventId);
}

export async function markNotificationsRead(userId, notificationIds) {
  const query = db().from("notifications").update({ unread: false }).eq("user_id", userId);
  if (notificationIds?.length) query.in("id", notificationIds);
  const { error } = await query;
  return { error: error?.message || null };
}

export async function saveResource(userId, resource) {
  const { data, error } = await db()
    .from("saved_resources")
    .insert({
      user_id: userId,
      category: resource.category,
      title: resource.title,
      description: resource.description || null,
      url: resource.url || null
    })
    .select()
    .single();
  return { resource: data ? mapResource(data) : null, error: error?.message || null };
}

export async function sendMessage(userId, payload) {
  return sendSupabaseMessage(userId, payload);
}

export async function createNotification(userId, { title, body, link }) {
  const { data, error } = await db()
    .from("notifications")
    .insert({ user_id: userId, title, body, link: link || null })
    .select()
    .single();
  return { notification: data ? mapNotification(data) : null, error: error?.message || null };
}

export {
  getCurrentUser,
  getMyProfile,
  updateMyProfile,
  getMyCalendarEvents,
  getMyMessages,
  getMyTasks,
  getMyEssayDrafts,
  getMyDeadlines,
  getMySettings,
  updateMySettings,
  getMyMentorMatches,
  getMatchAnswers,
  mapCalendarEvent,
  mapCalendarEvent as mapMeeting,
  mapMentorMatch as mapMentor,
  mapProfileRow as mapProfile,
  mapPreferences,
  mapOnboarding,
  mapMessage
};
