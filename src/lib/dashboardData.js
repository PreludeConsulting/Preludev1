/**
 * Supabase dashboard data helpers — tasks, essays, deadlines, settings, matches.
 */

import { getSupabase } from "./supabase.js";
import {
  EARN_CATEGORY_ORDER,
  MOMENTUM_TASK_DEFS,
  REWARD_TASK_CATEGORY,
  REWARD_TASK_OWNERSHIP,
  REWARD_TASK_STATUS,
  getTaskDefinition,
  taskTemplateIdsForCategory
} from "./rewardTaskCatalog.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function requireUserId(userId) {
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

function logFeatureError(feature, error) {
  if (import.meta.env.DEV) console.error(`[prelude-${feature}]`, error);
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
    essay_comments: prefs.essayComments,
    college_application_updates: prefs.collegeApplicationUpdates,
    scholarship_reminders: prefs.scholarshipReminders,
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapRewardTaskInstance(row) {
  return {
    id: row.id,
    userId: row.user_id,
    taskTemplateId: row.task_template_id,
    category: row.category,
    title: row.title,
    ownership: row.ownership_type,
    status: row.status,
    coins: row.coin_value,
    progressCurrent: row.progress_current || 0,
    progressTarget: row.progress_target || 1,
    completedByMentorId: row.completed_by_mentor_id || null,
    completedAt: row.completed_at || null,
    claimableAt: row.claimable_at || null,
    claimedAt: row.claimed_at || null,
    metadata: row.metadata || {}
  };
}

export async function getRewardWallet(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("reward_wallets")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  return {
    wallet: data || { user_id: id, coin_balance: 0, lifetime_earned: 0, lifetime_claimed: 0 },
    error: error?.message || null
  };
}

export async function ensureRewardTaskInstances(userId, { satActUnlocked = false, tutoringUnlocked = false } = {}) {
  const id = requireUserId(userId);
  const categoriesWithFixedCount = [
    { category: REWARD_TASK_CATEGORY.ADMISSIONS, count: 5 },
    { category: REWARD_TASK_CATEGORY.SAT_ACT, count: 5 },
    { category: REWARD_TASK_CATEGORY.ACADEMIC_TUTORING, count: 5 }
  ];

  const { data: existingRows } = await db()
    .from("reward_task_instances")
    .select("*")
    .eq("user_id", id);
  const existing = (existingRows || []).map(mapRewardTaskInstance);
  const existingTemplateIds = new Set(existing.map((row) => row.taskTemplateId));

  const insertRows = [];

  for (const momentumTask of MOMENTUM_TASK_DEFS) {
    if (existingTemplateIds.has(momentumTask.id)) continue;
    insertRows.push({
      user_id: id,
      task_template_id: momentumTask.id,
      category: momentumTask.category,
      title: momentumTask.title,
      ownership_type: momentumTask.ownership,
      status: REWARD_TASK_STATUS.IN_PROGRESS,
      coin_value: momentumTask.coins,
      progress_current: 0,
      progress_target: momentumTask.targetCount,
      metadata: { mainMentorOnly: Boolean(momentumTask.mainMentorOnly) }
    });
  }

  for (const group of categoriesWithFixedCount) {
    const templateIds = taskTemplateIdsForCategory(group.category);
    const activeUnclaimed = existing.filter(
      (task) =>
        task.category === group.category &&
        task.status !== REWARD_TASK_STATUS.CLAIMED
    );
    const needed = Math.max(0, group.count - activeUnclaimed.length);
    if (!needed) continue;
    const usedInCategory = new Set(existing.filter((task) => task.category === group.category).map((task) => task.taskTemplateId));
    const available = templateIds.filter((taskTemplateId) => !usedInCategory.has(taskTemplateId)).slice(0, needed);
    for (const taskTemplateId of available) {
      const def = getTaskDefinition(taskTemplateId);
      if (!def) continue;
      const lockForPlan =
        (group.category === REWARD_TASK_CATEGORY.SAT_ACT && !satActUnlocked) ||
        (group.category === REWARD_TASK_CATEGORY.ACADEMIC_TUTORING && !tutoringUnlocked);
      insertRows.push({
        user_id: id,
        task_template_id: taskTemplateId,
        category: def.category,
        title: def.title,
        ownership_type: def.ownership,
        status: lockForPlan ? REWARD_TASK_STATUS.LOCKED : REWARD_TASK_STATUS.IN_PROGRESS,
        coin_value: def.coins,
        progress_current: 0,
        progress_target: def.targetCount,
        metadata: {}
      });
    }
  }

  if (insertRows.length) {
    await db().from("reward_task_instances").insert(insertRows);
  }

  const { data, error } = await db()
    .from("reward_task_instances")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: true });
  return { tasks: (data || []).map(mapRewardTaskInstance), error: error?.message || null };
}

export async function listRewardTaskInstances(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("reward_task_instances")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: true });
  return { tasks: (data || []).map(mapRewardTaskInstance), error: error?.message || null };
}

export async function claimRewardTask(userId, taskInstanceId) {
  const id = requireUserId(userId);
  const { data: taskRow, error: taskErr } = await db()
    .from("reward_task_instances")
    .select("*")
    .eq("id", taskInstanceId)
    .eq("user_id", id)
    .maybeSingle();
  if (taskErr) return { error: taskErr.message, task: null, wallet: null };
  if (!taskRow) return { error: "Reward task not found.", task: null, wallet: null };
  if (taskRow.status === REWARD_TASK_STATUS.CLAIMED) return { error: "Reward already claimed.", task: mapRewardTaskInstance(taskRow), wallet: null };
  if (![REWARD_TASK_STATUS.READY_TO_CLAIM, REWARD_TASK_STATUS.COMPLETED_BY_MENTOR].includes(taskRow.status)) {
    return { error: "Reward is not claimable yet.", task: mapRewardTaskInstance(taskRow), wallet: null };
  }

  const now = new Date().toISOString();
  const { data: updatedTask, error: updateErr } = await db()
    .from("reward_task_instances")
    .update({ status: REWARD_TASK_STATUS.CLAIMED, claimed_at: now, updated_at: now })
    .eq("id", taskInstanceId)
    .eq("user_id", id)
    .in("status", [REWARD_TASK_STATUS.READY_TO_CLAIM, REWARD_TASK_STATUS.COMPLETED_BY_MENTOR])
    .select("*")
    .maybeSingle();
  if (updateErr) return { error: updateErr.message, task: null, wallet: null };
  if (!updatedTask) return { error: "Reward claim already processed.", task: null, wallet: null };

  const { wallet } = await getRewardWallet(id);
  const nextBalance = Number(wallet.coin_balance || 0) + Number(updatedTask.coin_value || 0);
  const { data: nextWallet, error: walletErr } = await db()
    .from("reward_wallets")
    .upsert(
      {
        user_id: id,
        coin_balance: nextBalance,
        lifetime_earned: Number(wallet.lifetime_earned || 0) + Number(updatedTask.coin_value || 0),
        lifetime_claimed: Number(wallet.lifetime_claimed || 0) + 1,
        updated_at: now
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .maybeSingle();
  return { task: mapRewardTaskInstance(updatedTask), wallet: nextWallet || null, error: walletErr?.message || null };
}

export async function isMainMentorForStudent(mentorUserId, studentUserId) {
  const mentorId = requireUserId(mentorUserId);
  const studentId = requireUserId(studentUserId);
  const { data: assigned, error: assignedErr } = await db()
    .from("mentor_matches")
    .select("mentor_id")
    .eq("student_id", studentId)
    .eq("mentor_id", mentorId)
    .in("status", ["assigned", "accepted", "active"])
    .limit(1);
  if (assignedErr) return { isMain: false, isAssigned: false, error: assignedErr.message };
  if (!assigned?.length) return { isMain: false, isAssigned: false, error: null };

  const { data: mainMentor, error: mainErr } = await db()
    .from("mentor_matches")
    .select("mentor_id")
    .eq("student_id", studentId)
    .eq("status", "assigned")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (mainErr) return { isMain: false, isAssigned: true, error: mainErr.message };
  return { isMain: mainMentor?.mentor_id === mentorId, isAssigned: true, error: null };
}

export async function completeMentorControlledRewardTask(mentorUserId, studentUserId, taskInstanceId) {
  const mentorId = requireUserId(mentorUserId);
  const studentId = requireUserId(studentUserId);
  const now = new Date().toISOString();

  const { data: taskRow, error: taskErr } = await db()
    .from("reward_task_instances")
    .select("*")
    .eq("id", taskInstanceId)
    .eq("user_id", studentId)
    .maybeSingle();
  if (taskErr) return { error: taskErr.message, task: null };
  if (!taskRow) return { error: "Task not found.", task: null };
  if (taskRow.ownership_type !== REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED) {
    return { error: "This task is auto-tracked and cannot be completed by mentors.", task: null };
  }
  if (taskRow.status === REWARD_TASK_STATUS.LOCKED) {
    return { error: "Task is locked for this student plan.", task: null };
  }

  const { data: assigned } = await db()
    .from("mentor_matches")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "assigned")
    .eq("mentor_id", mentorId)
    .limit(1);
  if (!assigned?.length) return { error: "You are not assigned to this student.", task: null };

  if (taskRow.task_template_id === "mentor-meeting-completed") {
    const { data: mainMentor } = await db()
      .from("mentor_matches")
      .select("mentor_id")
      .eq("student_id", studentId)
      .eq("status", "assigned")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (mainMentor?.mentor_id && mainMentor.mentor_id !== mentorId) {
      return { error: "Only the student's main assigned mentor can complete this task.", task: null };
    }
  }

  const { data: updated, error: updateErr } = await db()
    .from("reward_task_instances")
    .update({
      status: REWARD_TASK_STATUS.COMPLETED_BY_MENTOR,
      completed_by_mentor_id: mentorId,
      completed_at: now,
      claimable_at: now,
      progress_current: taskRow.progress_target || 1,
      updated_at: now
    })
    .eq("id", taskInstanceId)
    .eq("user_id", studentId)
    .in("status", [REWARD_TASK_STATUS.IN_PROGRESS, REWARD_TASK_STATUS.READY_TO_COMPLETE])
    .select("*")
    .maybeSingle();
  return { task: updated ? mapRewardTaskInstance(updated) : null, error: updateErr?.message || null };
}

export async function upsertStudentDailyActivity(userId, patch = {}) {
  const id = requireUserId(userId);
  const date = patch.activityDate || todayIsoDate();
  const payload = {
    user_id: id,
    activity_date: date,
    logged_in: patch.loggedIn ?? false,
    mentors_messaged_count: patch.mentorsMessagedCount ?? 0,
    network_message_goal_met: patch.networkMessageGoalMet ?? false,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db()
    .from("student_daily_activity")
    .upsert(payload, { onConflict: "user_id,activity_date" })
    .select("*")
    .maybeSingle();
  return { activity: data, error: error?.message || null };
}

function calculateConsecutiveDays(rows = [], predicate) {
  if (!rows.length) return 0;
  const sorted = [...rows].sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date)));
  let streak = 0;
  let cursor = new Date(`${sorted[0].activity_date}T00:00:00.000Z`);
  for (const row of sorted) {
    const rowDate = new Date(`${row.activity_date}T00:00:00.000Z`);
    if (rowDate.getTime() !== cursor.getTime()) break;
    if (!predicate(row)) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export async function syncDashboardControlledRewardTasks(userId) {
  const id = requireUserId(userId);
  await upsertStudentDailyActivity(id, { activityDate: todayIsoDate(), loggedIn: true });
  const { data: activityRows } = await db()
    .from("student_daily_activity")
    .select("*")
    .eq("user_id", id)
    .order("activity_date", { ascending: false })
    .limit(30);
  const loginStreak = calculateConsecutiveDays(activityRows || [], (row) => Boolean(row.logged_in));
  const messageStreak = calculateConsecutiveDays(activityRows || [], (row) => Boolean(row.network_message_goal_met));

  const { data: taskRows } = await db()
    .from("reward_task_instances")
    .select("*")
    .eq("user_id", id)
    .eq("ownership_type", REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED);

  const updates = [];
  for (const row of taskRows || []) {
    const now = new Date().toISOString();
    let progressCurrent = row.progress_current || 0;
    if (row.task_template_id === "momentum-7-day-login-streak") progressCurrent = Math.min(7, loginStreak);
    if (row.task_template_id === "mentor-network-3-day-streak") progressCurrent = Math.min(3, messageStreak);
    if (row.task_template_id === "mentor-network-7-day-streak") progressCurrent = Math.min(7, messageStreak);
    const target = row.progress_target || 1;
    const ready = progressCurrent >= target;
    const nextStatus = row.status === REWARD_TASK_STATUS.CLAIMED
      ? REWARD_TASK_STATUS.CLAIMED
      : ready
        ? REWARD_TASK_STATUS.READY_TO_CLAIM
        : REWARD_TASK_STATUS.IN_PROGRESS;
    if (progressCurrent !== row.progress_current || nextStatus !== row.status) {
      updates.push({
        id: row.id,
        progress_current: progressCurrent,
        status: nextStatus,
        claimable_at: ready ? now : null,
        updated_at: now
      });
    }
  }

  for (const update of updates) {
    await db().from("reward_task_instances").update(update).eq("id", update.id);
  }
  return { loginStreak, messageStreak, error: null };
}

export async function syncStudentNetworkMessageActivity(userId) {
  const id = requireUserId(userId);
  const { data } = await db()
    .from("messages")
    .select("receiver_id,created_at,sender_role")
    .eq("sender_id", id)
    .order("created_at", { ascending: false })
    .limit(500);
  const dayToMentors = new Map();
  for (const row of data || []) {
    const day = String(row.created_at || "").slice(0, 10);
    if (!day) continue;
    if (!dayToMentors.has(day)) dayToMentors.set(day, new Set());
    if (row.receiver_id) dayToMentors.get(day).add(row.receiver_id);
  }
  for (const [day, mentorIds] of dayToMentors.entries()) {
    await upsertStudentDailyActivity(id, {
      activityDate: day,
      loggedIn: day === todayIsoDate(),
      mentorsMessagedCount: mentorIds.size,
      networkMessageGoalMet: mentorIds.size >= 3
    });
  }
  return { error: null };
}

export async function listMentorRewardStudents(mentorUserId) {
  const mentorId = requireUserId(mentorUserId);
  const { data: matches, error } = await db()
    .from("mentor_matches")
    .select("*")
    .eq("mentor_id", mentorId)
    .in("status", ["assigned", "accepted", "active"])
    .order("created_at", { ascending: false });
  if (error) return { students: [], error: error.message };

  const studentIds = [...new Set((matches || []).map((row) => row.student_id).filter(Boolean))];
  if (!studentIds.length) return { students: [], error: null };
  const { data: profiles } = await db().from("profiles").select("id,full_name,grade_level").in("id", studentIds);
  const nameById = Object.fromEntries((profiles || []).map((row) => [row.id, row.full_name || "Student"]));
  const gradeById = Object.fromEntries((profiles || []).map((row) => [row.id, row.grade_level || ""]));
  const students = studentIds.map((studentId) => ({
    id: studentId,
    name: nameById[studentId] || "Student",
    grade: gradeById[studentId] || "",
    isMainMentor: (matches || []).some((row) => row.student_id === studentId && row.status === "assigned")
  }));
  return { students, error: null };
}

function mapRewardRedemption(row) {
  return {
    id: row.id,
    rewardId: row.reward_id,
    title: row.title,
    coinCost: row.coin_cost,
    status: row.status,
    selection: row.selection || null,
    redeemedAt: row.redeemed_at
  };
}

export async function listRewardRedemptions(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("reward_redemptions")
    .select("*")
    .eq("user_id", id)
    .order("redeemed_at", { ascending: false });
  if (error) logFeatureError("rewards", error);
  return {
    redemptions: (data || []).map(mapRewardRedemption),
    error: error ? "Rewards are temporarily unavailable. Retry in a moment." : null
  };
}

export async function redeemCatalogReward(userId, { rewardId, selection = null }) {
  requireUserId(userId);
  const { data, error } = await db().rpc("redeem_catalog_reward", {
    p_reward_id: rewardId,
    p_selection: selection
  });
  if (error) {
    logFeatureError("rewards", error);
    const message = String(error.message || "");
    if (/already redeemed|duplicate/i.test(message) || error.code === "23505") {
      return { error: "You already redeemed this reward.", alreadyRedeemed: true };
    }
    if (/not enough coins/i.test(message) || error.code === "22003") {
      return { error: "Not enough coins to redeem this reward." };
    }
    return { error: "Reward redemption is temporarily unavailable. Retry in a moment." };
  }

  return {
    redemption: data?.redemption ? mapRewardRedemption(data.redemption) : null,
    wallet: data?.wallet || null,
    error: null
  };
}

export { mapTask, mapEssay, mapDeadline, mapSettings, mapMentorMatch, mapScholarship };
