/**
 * Supabase dashboard data — per-user CRUD keyed by auth.users.id.
 * Used when VITE_SUPABASE_* is configured (no Prisma JWT cookies).
 */

import { getSupabase } from "./supabase.js";

function db() {
  return getSupabase();
}

function mapEvent(row) {
  const isUserCreated = row.event_type === "personal" || row.event_type === "session";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start: row.start_time,
    end: row.end_time,
    startTime: row.start_time,
    endTime: row.end_time,
    eventType: row.event_type,
    location: row.location,
    meetingType: row.meeting_url ? "zoom" : row.location ? "in_person" : "zoom",
    zoomJoinUrl: row.meeting_url,
    status: row.status,
    category: row.event_type === "personal" ? "personal_task" : "mentor_meeting",
    formVariant: row.event_type === "personal" ? "task" : isUserCreated ? "event" : undefined,
    calendarItemType: row.event_type === "personal" ? "task" : isUserCreated ? "event" : undefined,
    userCreated: isUserCreated,
    pillColor: isUserCreated ? "blue" : undefined
  };
}

function mapMeeting(row) {
  return mapEvent(row);
}

function mapMentor(row) {
  return {
    id: row.id,
    name: row.mentor_name,
    email: row.mentor_email,
    college: row.mentor_college,
    university: row.mentor_college,
    major: row.mentor_major,
    expertise: Array.isArray(row.expertise) ? row.expertise : [],
    availability: row.availability || "",
    status: row.status,
    notes: row.notes
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

function mapMessage(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    body: row.body,
    read: row.read,
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

function mapProfile(row, email) {
  if (!row) return null;
  const majors = Array.isArray(row.target_majors) ? row.target_majors : [];
  return {
    grade: row.grade_level,
    graduationYear: row.graduation_year,
    gpa: row.gpa,
    weightedGpa: row.weighted_gpa,
    sat: row.sat,
    bio: row.bio,
    academicGoals: row.academic_goals,
    collegeInterests: Array.isArray(row.college_interests) ? row.college_interests : [],
    mentorPreferences: row.mentor_preferences || {},
    targetMajors: majors,
    majors,
    colleges: Array.isArray(row.college_interests) ? row.college_interests : [],
    school: row.school,
    email
  };
}

function mapPreferences(row) {
  if (!row) return null;
  return {
    emailUpdates: row.email_updates,
    meetingReminders: row.meeting_reminders,
    mentorMessages: row.mentor_messages,
    weeklyDigest: row.weekly_digest,
    productTips: row.product_tips,
    defaultCalendarView: row.default_calendar_view,
    reminderLeadTime: row.reminder_lead_time,
    weekStart: row.week_start,
    density: row.density,
    reduceMotion: row.reduce_motion,
    profileVisibility: row.profile_visibility,
    theme: row.theme
  };
}

function mapOnboarding(row) {
  if (!row) return { profileComplete: 0, mentorMatchingStarted: false, mentorMatchingComplete: false, questionnaireAnswers: {} };
  return {
    profileComplete: row.profile_complete ?? 0,
    mentorMatchingStarted: row.mentor_matching_started,
    mentorMatchingComplete: row.mentor_matching_complete,
    questionnaireAnswers: row.questionnaire_answers || {}
  };
}

/** Load all dashboard data for the signed-in user. */
export async function loadSupabaseDashboard(userId, email) {
  const supabase = db();
  const [
    profileRes,
    prefsRes,
    onboardingRes,
    mentorsRes,
    eventsRes,
    messagesRes,
    notificationsRes,
    resourcesRes
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("onboarding_progress").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("mentor_matches").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("calendar_events").select("*").eq("user_id", userId).order("start_time", { ascending: true }),
    supabase.from("messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("saved_resources").select("*").eq("user_id", userId).order("saved_at", { ascending: false })
  ]);

  const mentors = (mentorsRes.data || []).map(mapMentor);
  const assigned = mentors.find((m) => m.status === "assigned") || mentors[0] || null;
  const events = (eventsRes.data || []).map(mapEvent);
  const meetings = events.filter((e) => e.eventType === "meeting" || e.eventType === "session");
  const messages = (messagesRes.data || []).map(mapMessage);
  const onboarding = mapOnboarding(onboardingRes.data);

  return {
    profile: mapProfile(profileRes.data, email),
    preferences: mapPreferences(prefsRes.data),
    onboarding,
    mentor: assigned,
    mentors,
    meetings,
    events,
    messages,
    conversations: messages.length
      ? [{ id: "mentor", name: assigned?.name || "Mentor", preview: messages[0]?.body, unread: messages.some((m) => !m.read) }]
      : [],
    notifications: (notificationsRes.data || []).map(mapNotification),
    savedResources: (resourcesRes.data || []).map(mapResource),
    errors: [
      profileRes.error,
      prefsRes.error,
      onboardingRes.error,
      mentorsRes.error,
      eventsRes.error,
      messagesRes.error,
      notificationsRes.error,
      resourcesRes.error
    ].filter(Boolean)
  };
}

export async function updateSupabaseProfile(userId, fields) {
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
  if (fields.targetMajors !== undefined) payload.target_majors = fields.targetMajors;

  const { data, error } = await db().from("profiles").update(payload).eq("id", userId).select().maybeSingle();
  return { profile: data, error: error?.message || null };
}

export async function updateSupabasePreferences(userId, prefs) {
  const payload = {
    updated_at: new Date().toISOString(),
    email_updates: prefs.emailUpdates,
    meeting_reminders: prefs.meetingReminders,
    mentor_messages: prefs.mentorMessages,
    weekly_digest: prefs.weeklyDigest,
    product_tips: prefs.productTips,
    default_calendar_view: prefs.defaultCalendarView,
    reminder_lead_time: prefs.reminderLeadTime,
    week_start: prefs.weekStart,
    density: prefs.density,
    reduce_motion: prefs.reduceMotion,
    profile_visibility: prefs.profileVisibility,
    theme: prefs.theme
  };

  const { data, error } = await db()
    .from("user_preferences")
    .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  return { preferences: data, error: error?.message || null };
}

export async function updateSupabaseOnboarding(userId, fields) {
  const payload = { updated_at: new Date().toISOString() };
  if (fields.profileComplete !== undefined) payload.profile_complete = fields.profileComplete;
  if (fields.mentorMatchingStarted !== undefined) payload.mentor_matching_started = fields.mentorMatchingStarted;
  if (fields.mentorMatchingComplete !== undefined) payload.mentor_matching_complete = fields.mentorMatchingComplete;
  if (fields.questionnaireAnswers !== undefined) payload.questionnaire_answers = fields.questionnaireAnswers;

  const { data, error } = await db()
    .from("onboarding_progress")
    .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  return { onboarding: data, error: error?.message || null };
}

export async function createCalendarEvent(userId, event) {
  const { data, error } = await db()
    .from("calendar_events")
    .insert({
      user_id: userId,
      title: event.title,
      description: event.description || null,
      start_time: event.startTime || event.start,
      end_time: event.endTime || event.end || null,
      event_type: event.eventType || "meeting",
      location: event.location || null,
      meeting_url: event.meetingUrl || event.zoomJoinUrl || null,
      status: event.status || "scheduled"
    })
    .select()
    .single();
  return { event: data ? mapEvent(data) : null, error: error?.message || null };
}

export async function updateCalendarEvent(userId, eventId, event) {
  const payload = {};
  if (event.title !== undefined) payload.title = event.title;
  if (event.description !== undefined) payload.description = event.description;
  if (event.startTime !== undefined) payload.start_time = event.startTime;
  if (event.start !== undefined) payload.start_time = event.start;
  if (event.endTime !== undefined) payload.end_time = event.endTime;
  if (event.end !== undefined) payload.end_time = event.end;
  if (event.eventType !== undefined) payload.event_type = event.eventType;
  if (event.location !== undefined) payload.location = event.location;
  if (event.meetingUrl !== undefined) payload.meeting_url = event.meetingUrl;
  if (event.zoomJoinUrl !== undefined) payload.meeting_url = event.zoomJoinUrl;
  if (event.status !== undefined) payload.status = event.status;

  const { data, error } = await db()
    .from("calendar_events")
    .update(payload)
    .eq("id", eventId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  return { event: data ? mapEvent(data) : null, error: error?.message || null };
}

export async function deleteCalendarEvent(userId, eventId) {
  const { error } = await db()
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId);
  return { error: error?.message || null };
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

export async function sendMessage(userId, { body, senderName, senderRole = "student", threadId = "mentor" }) {
  const { data, error } = await db()
    .from("messages")
    .insert({
      user_id: userId,
      thread_id: threadId,
      sender_name: senderName,
      sender_role: senderRole,
      body,
      read: true
    })
    .select()
    .single();
  return { message: data ? mapMessage(data) : null, error: error?.message || null };
}

export async function createNotification(userId, { title, body, link }) {
  const { data, error } = await db()
    .from("notifications")
    .insert({ user_id: userId, title, body, link: link || null })
    .select()
    .single();
  return { notification: data ? mapNotification(data) : null, error: error?.message || null };
}

export { mapMeeting, mapMentor, mapProfile, mapPreferences, mapOnboarding };
