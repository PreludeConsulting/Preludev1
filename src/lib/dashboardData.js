/**
 * Supabase dashboard data helpers — tasks, essays, deadlines, settings, matches.
 */

import { getSupabase } from "./supabase.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function requireUserId(userId) {
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

export async function getCurrentUser() {
  const { data, error } = await db().auth.getUser();
  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority || "medium",
    done: row.done
  };
}

function mapEssay(row) {
  const words = row.body ? row.body.trim().split(/\s+/).filter(Boolean).length : 0;
  return {
    id: row.id,
    title: row.title,
    body: row.body || "",
    words,
    status: row.status || (words > 0 ? "In Progress" : "Not started"),
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "—"
  };
}

function mapDeadline(row) {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date_label || row.due_date || "",
    category: row.category || "General",
    priority: row.priority || "medium",
    done: row.done
  };
}

function mapSettings(row) {
  if (!row) return null;
  return {
    emailUpdates: row.email_updates,
    meetingReminders: row.meeting_reminders,
    mentorMessages: row.mentor_messages,
    studentMessages: row.student_messages,
    deadlineReminders: row.deadline_reminders,
    progressReminders: row.progress_reminders,
    rewardUpdates: row.reward_updates,
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

function mapScholarship(row) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount || 0),
    deadline: row.deadline || "",
    eligibility: row.eligibility || "",
    requiredMaterials: Array.isArray(row.required_materials) ? row.required_materials : [],
    essayRequired: Boolean(row.essay_required),
    recommendationRequired: Boolean(row.recommendation_required),
    status: row.status || "Saved",
    submissionDate: row.submission_date || "",
    result: row.result || "",
    notes: row.notes || "",
    link: row.link || "",
    reminder: row.reminder || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMentorMatch(row) {
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
    notes: row.notes,
    studentId: row.student_id || row.user_id,
    mentorId: row.mentor_id
  };
}

const SETTINGS_TABLE = "user_settings";

async function querySettings(userId) {
  return db().from(SETTINGS_TABLE).select("*").eq("user_id", userId).maybeSingle();
}

async function upsertSettings(userId, payload) {
  return db()
    .from(SETTINGS_TABLE)
    .upsert({ user_id: userId, ...payload }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
}

export async function getMyTasks(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("dashboard_tasks")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: true });
  return { tasks: (data || []).map(mapTask), error: error?.message || null };
}

export async function createTask(userId, { title, priority = "medium" }) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("dashboard_tasks")
    .insert({ user_id: id, title, priority })
    .select()
    .single();
  return { task: data ? mapTask(data) : null, error: error?.message || null };
}

export async function updateTask(userId, taskId, fields) {
  const id = requireUserId(userId);
  const payload = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) payload.title = fields.title;
  if (fields.priority !== undefined) payload.priority = fields.priority;
  if (fields.done !== undefined) payload.done = fields.done;

  const { data, error } = await db()
    .from("dashboard_tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("user_id", id)
    .select()
    .maybeSingle();
  return { task: data ? mapTask(data) : null, error: error?.message || null };
}

export async function deleteTask(userId, taskId) {
  const id = requireUserId(userId);
  const { error } = await db().from("dashboard_tasks").delete().eq("id", taskId).eq("user_id", id);
  return { error: error?.message || null };
}

export async function getMyEssayDrafts(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("essay_drafts")
    .select("*")
    .eq("user_id", id)
    .order("updated_at", { ascending: false });
  return { essays: (data || []).map(mapEssay), error: error?.message || null };
}

export async function saveEssayDraft(userId, essayId, { title, body, status }) {
  const id = requireUserId(userId);
  const words = body ? body.trim().split(/\s+/).filter(Boolean).length : 0;
  const payload = {
    title,
    body: body ?? "",
    status: status || (words > 0 ? "In Progress" : "Not started"),
    updated_at: new Date().toISOString()
  };

  if (essayId) {
    const { data, error } = await db()
      .from("essay_drafts")
      .update(payload)
      .eq("id", essayId)
      .eq("user_id", id)
      .select()
      .maybeSingle();
    return { essay: data ? mapEssay(data) : null, error: error?.message || null };
  }

  const { data, error } = await db()
    .from("essay_drafts")
    .insert({ user_id: id, ...payload })
    .select()
    .single();
  return { essay: data ? mapEssay(data) : null, error: error?.message || null };
}

export async function getMyDeadlines(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("deadlines")
    .select("*")
    .eq("user_id", id)
    .order("due_date", { ascending: true, nullsFirst: false });
  return { deadlines: (data || []).map(mapDeadline), error: error?.message || null };
}

export async function createDeadline(userId, deadline) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("deadlines")
    .insert({
      user_id: id,
      title: deadline.title,
      due_date: deadline.dueDateIso || null,
      due_date_label: deadline.dueDate || deadline.dueDateLabel || null,
      category: deadline.category || null,
      priority: deadline.priority || "medium",
      done: deadline.done ?? false
    })
    .select()
    .single();
  return { deadline: data ? mapDeadline(data) : null, error: error?.message || null };
}

export async function getMySettings(userId) {
  const id = requireUserId(userId);
  const { data, error } = await querySettings(id);
  return { settings: mapSettings(data), error: error?.message || null };
}

export async function updateMySettings(userId, prefs) {
  const id = requireUserId(userId);
  const payload = {
    updated_at: new Date().toISOString(),
    email_updates: prefs.emailUpdates,
    meeting_reminders: prefs.meetingReminders,
    mentor_messages: prefs.mentorMessages,
    student_messages: prefs.studentMessages,
    deadline_reminders: prefs.deadlineReminders,
    progress_reminders: prefs.progressReminders,
    reward_updates: prefs.rewardUpdates,
    parent_summaries: prefs.parentSummaries,
    notification_sounds: prefs.notificationSounds,
    interface_sounds: prefs.interfaceSounds,
    weekly_digest: prefs.weeklyDigest,
    digest_frequency: prefs.digestFrequency,
    quiet_hours_enabled: prefs.quietHoursEnabled,
    quiet_hours_start: prefs.quietHoursStart,
    quiet_hours_end: prefs.quietHoursEnd,
    product_tips: prefs.productTips,
    default_calendar_view: prefs.defaultCalendarView,
    reminder_lead_time: prefs.reminderLeadTime,
    week_start: prefs.weekStart,
    density: prefs.density,
    reduce_motion: prefs.reduceMotion,
    haptic_feedback: prefs.hapticFeedback,
    profile_visibility: prefs.profileVisibility,
    theme: prefs.theme,
    data_export_requested_at: prefs.dataExportRequestedAt
  };
  const { data, error } = await upsertSettings(id, payload);
  return { settings: mapSettings(data), error: error?.message || null };
}

export async function getMyScholarships(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("scholarships")
    .select("*")
    .eq("user_id", id)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return { scholarships: (data || []).map(mapScholarship), error: error?.message || null };
}

export async function createScholarship(userId, scholarship) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("scholarships")
    .insert({ user_id: id, ...scholarshipToRow(scholarship) })
    .select()
    .single();
  return { scholarship: data ? mapScholarship(data) : null, error: error?.message || null };
}

export async function updateScholarship(userId, scholarshipId, fields) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("scholarships")
    .update({ ...scholarshipToRow(fields), updated_at: new Date().toISOString() })
    .eq("id", scholarshipId)
    .eq("user_id", id)
    .select()
    .maybeSingle();
  return { scholarship: data ? mapScholarship(data) : null, error: error?.message || null };
}

export async function deleteScholarship(userId, scholarshipId) {
  const id = requireUserId(userId);
  const { error } = await db().from("scholarships").delete().eq("id", scholarshipId).eq("user_id", id);
  return { error: error?.message || null };
}

function scholarshipToRow(input = {}) {
  const row = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.amount !== undefined) row.amount = Number(input.amount || 0);
  if (input.deadline !== undefined) row.deadline = input.deadline || null;
  if (input.eligibility !== undefined) row.eligibility = input.eligibility || null;
  if (input.requiredMaterials !== undefined) row.required_materials = Array.isArray(input.requiredMaterials) ? input.requiredMaterials : [];
  if (input.essayRequired !== undefined) row.essay_required = Boolean(input.essayRequired);
  if (input.recommendationRequired !== undefined) row.recommendation_required = Boolean(input.recommendationRequired);
  if (input.status !== undefined) row.status = input.status;
  if (input.submissionDate !== undefined) row.submission_date = input.submissionDate || null;
  if (input.result !== undefined) row.result = input.result || null;
  if (input.notes !== undefined) row.notes = input.notes || null;
  if (input.link !== undefined) row.link = input.link || null;
  if (input.reminder !== undefined) row.reminder = input.reminder || null;
  return row;
}

export async function getMyMentorMatches(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("mentor_matches")
    .select("*")
    .or(`student_id.eq.${id},user_id.eq.${id},mentor_id.eq.${id}`)
    .order("created_at", { ascending: false });
  return { matches: (data || []).map(mapMentorMatch), error: error?.message || null };
}

export async function saveMatchAnswer(userId, questionId, answer) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("match_answers")
    .upsert(
      {
        user_id: id,
        question_id: questionId,
        answer,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,question_id" }
    )
    .select()
    .maybeSingle();
  return { answer: data, error: error?.message || null };
}

export async function getMatchAnswers(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("match_answers")
    .select("*")
    .eq("user_id", id)
    .order("updated_at", { ascending: true });
  const answers = {};
  (data || []).forEach((row) => {
    answers[row.question_id] = row.answer;
  });
  return { answers, rows: data || [], error: error?.message || null };
}

export async function getMyCollegeList(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("college_lists")
    .select("colleges")
    .eq("user_id", id)
    .maybeSingle();
  return {
    colleges: Array.isArray(data?.colleges) ? data.colleges : [],
    error: error?.message || null
  };
}

export async function saveMyCollegeList(userId, colleges) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("college_lists")
    .upsert(
      { user_id: id, colleges, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("colleges")
    .maybeSingle();
  return {
    colleges: Array.isArray(data?.colleges) ? data.colleges : colleges,
    error: error?.message || null
  };
}

export { mapTask, mapEssay, mapDeadline, mapSettings, mapMentorMatch, mapScholarship };
