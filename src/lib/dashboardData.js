/**
 * Supabase dashboard data helpers — tasks, essays, deadlines, settings, matches.
 */

import { getSupabase } from "./supabase.js";
import { enrichAssignedMentorMatch } from "./studentMentorCard.js";

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
    availabilitySchedule: row.availability_schedule || row.availabilitySchedule || null,
    status: row.status,
    notes: row.notes,
    studentId: row.student_id || row.user_id,
    mentorId: row.mentor_id,
    mentorUserId: row.mentor_id,
    userId: row.mentor_id
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

const MENTOR_MATCH_PROFILE_SELECT =
  "mentor_user_id, display_name, avatar_url, college, major, bio, specialties, target_majors, target_schools, support_styles, application_strengths, availability, availability_schedule";
const MENTOR_MATCH_PROFILE_FALLBACK_SELECT = "mentor_user_id, avatar_url, availability, availability_schedule";
const MENTOR_ACCOUNT_PROFILE_SELECT = "id, full_name, avatar_url, graduation_year";

async function loadMentorMatchEnrichment(mentorIds) {
  let matchingRes = await db()
    .from("mentor_matching_profiles")
    .select(MENTOR_MATCH_PROFILE_SELECT)
    .in("mentor_user_id", mentorIds);

  // Production schemas can lag behind the client select list — fall back instead of
  // failing the whole dashboard load for an enrichment-only query.
  if (matchingRes.error) {
    logFeatureError("mentor-match-enrichment", matchingRes.error.message);
    matchingRes = await db()
      .from("mentor_matching_profiles")
      .select(MENTOR_MATCH_PROFILE_FALLBACK_SELECT)
      .in("mentor_user_id", mentorIds);
  }

  const accountRes = await db()
    .from("profiles")
    .select(MENTOR_ACCOUNT_PROFILE_SELECT)
    .in("id", mentorIds);

  if (accountRes.error) {
    logFeatureError("mentor-account-enrichment", accountRes.error.message);
  }

  return {
    matchingById: Object.fromEntries(
      (matchingRes.data || []).map((profile) => [profile.mentor_user_id, profile])
    ),
    accountById: Object.fromEntries((accountRes.data || []).map((profile) => [profile.id, profile]))
  };
}

export async function getMyMentorMatches(userId) {
  const id = requireUserId(userId);
  const { data, error } = await db()
    .from("mentor_matches")
    .select("*")
    .or(`student_id.eq.${id},user_id.eq.${id},mentor_id.eq.${id}`)
    .order("created_at", { ascending: false });

  const matches = (data || []).map(mapMentorMatch);
  if (error || !matches.length) {
    return { matches, error: error?.message || null };
  }

  const mentorIds = [
    ...new Set(matches.map((match) => match.mentorUserId || match.userId).filter(Boolean))
  ];
  if (!mentorIds.length) return { matches, error: null };

  try {
    const { matchingById, accountById } = await loadMentorMatchEnrichment(mentorIds);
    return {
      matches: matches.map((match) => {
        const mentorKey = match.mentorUserId || match.userId;
        return enrichAssignedMentorMatch(match, matchingById[mentorKey] || null, accountById[mentorKey] || null);
      }),
      // Enrichment is best-effort; never block dashboard boot on profile joins.
      error: null
    };
  } catch (enrichmentError) {
    logFeatureError("mentor-match-enrichment", enrichmentError?.message || enrichmentError);
    return { matches, error: null };
  }
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
  const wallet = data || {
    user_id: id,
    coin_balance: 0,
    lifetime_earned: 0,
    lifetime_claimed: 0,
    lifetime_coins: 0
  };
  return {
    wallet: {
      ...wallet,
      lifetime_coins: Number(wallet.lifetime_coins ?? wallet.lifetime_earned ?? 0)
    },
    error: error?.message || null
  };
}

export async function grantRewardsWelcomeBonus(userId) {
  requireUserId(userId);
  try {
    const { data, error } = await db().rpc("grant_rewards_welcome_bonus");
    if (error) {
      logFeatureError("rewards", error);
      return { granted: false, wallet: null, error: error.message };
    }
    return {
      granted: Boolean(data?.granted),
      amount: data?.amount || 0,
      type: data?.type || null,
      label: data?.label || null,
      wallet: data?.wallet || null,
      error: null
    };
  } catch (error) {
    return { granted: false, wallet: null, error: error?.message || "Welcome bonus unavailable." };
  }
}

export async function ensureRewardTaskInstances(
  userId,
  { satActUnlocked = false, tutoringUnlocked = false, asStudentId = null } = {}
) {
  requireUserId(userId);
  try {
    const studentId = asStudentId || userId;
    // Mentors seeding a student's tasks must call the student-scoped RPC.
    // Self-ensure still uses ensure_reward_task_instances (auth.uid()).
    const { data, error } = asStudentId
      ? await db().rpc("ensure_student_reward_task_instances", {
          p_student_id: studentId,
          p_sat_act_unlocked: Boolean(satActUnlocked),
          p_tutoring_unlocked: Boolean(tutoringUnlocked)
        })
      : await db().rpc("ensure_reward_task_instances", {
          p_sat_act_unlocked: Boolean(satActUnlocked),
          p_tutoring_unlocked: Boolean(tutoringUnlocked)
        });
    if (error) {
      logFeatureError("rewards", error);
      return { tasks: [], error: error.message };
    }
    const rows = Array.isArray(data) ? data : Array.isArray(data?.tasks) ? data.tasks : [];
    if (rows.length) {
      return { tasks: rows.map(mapRewardTaskInstance), error: null };
    }
    return listRewardTaskInstances(studentId);
  } catch (error) {
    return { tasks: [], error: error?.message || "Reward tasks unavailable." };
  }
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

export async function claimRewardTask(userId, taskInstanceId, { proBoost = false } = {}) {
  requireUserId(userId);
  try {
    const { data, error } = await db().rpc("claim_reward_task", {
      p_task_instance_id: taskInstanceId,
      p_pro_boost: Boolean(proBoost)
    });
    if (error) {
      logFeatureError("rewards", error);
      return { error: error.message, task: null, wallet: null };
    }
    if (data?.error) {
      return {
        error: data.error,
        task: data.task ? mapRewardTaskInstance(data.task) : null,
        wallet: data.wallet || null
      };
    }
    const taskRow = data?.task || data;
    const wallet = data?.wallet || null;
    const mapped = taskRow ? mapRewardTaskInstance(taskRow) : null;
    return {
      task: mapped
        ? {
            ...mapped,
            coins: Number(data?.final_amount ?? data?.coins ?? mapped.coins),
            baseCoins: Number(data?.base_amount ?? data?.baseCoins ?? mapped.coins),
            multiplier: Number(data?.multiplier ?? 1)
          }
        : null,
      wallet: wallet
        ? { ...wallet, lifetime_coins: Number(wallet.lifetime_coins ?? wallet.lifetime_earned ?? 0) }
        : null,
      error: null
    };
  } catch (error) {
    return { error: error?.message || "Reward claim unavailable.", task: null, wallet: null };
  }
}

/**
 * Assigned mentors (assigned/accepted/active) may complete mentor-controlled
 * milestones including Mentor Meeting Completed. Unrelated mentors cannot.
 */
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
  // Any currently assigned mentor is authorized for mentor-controlled Complete.
  return { isMain: true, isAssigned: true, error: null };
}

export async function completeMentorControlledRewardTask(mentorUserId, studentUserId, taskInstanceId) {
  requireUserId(mentorUserId);
  requireUserId(studentUserId);
  try {
    const { data, error } = await db().rpc("complete_mentor_reward_task", {
      p_task_instance_id: taskInstanceId,
      p_student_id: studentUserId
    });
    if (error) {
      logFeatureError("rewards", error);
      return { error: error.message, task: null };
    }
    if (data?.error) {
      return { error: data.error, task: data.task ? mapRewardTaskInstance(data.task) : null };
    }
    const taskRow = data?.task || data;
    return { task: taskRow ? mapRewardTaskInstance(taskRow) : null, error: null };
  } catch (error) {
    return { error: error?.message || "Mentor task completion unavailable.", task: null };
  }
}

export async function upsertStudentDailyActivity(userId, _patch = {}) {
  requireUserId(userId);
  // Trusted path: RPC derives ownership from auth.uid(); ignores client user ids / forged streak fields.
  try {
    const { data, error } = await db().rpc("record_student_login_activity");
    if (error) {
      logFeatureError("rewards", error);
      return { activity: null, error: error.message };
    }
    return { activity: data?.activity || data || null, error: null };
  } catch (error) {
    return { activity: null, error: error?.message || "Daily activity unavailable." };
  }
}

export async function syncDashboardControlledRewardTasks(userId) {
  requireUserId(userId);
  try {
    const { data, error } = await db().rpc("sync_dashboard_reward_task_progress");
    if (error) {
      logFeatureError("rewards", error);
      return { loginStreak: 0, messageStreak: 0, error: error.message };
    }
    return {
      loginStreak: Number(data?.login_streak ?? data?.loginStreak ?? 0),
      messageStreak: Number(data?.message_streak ?? data?.messageStreak ?? 0),
      error: null
    };
  } catch (error) {
    return { loginStreak: 0, messageStreak: 0, error: error?.message || "Reward sync unavailable." };
  }
}

export async function syncStudentNetworkMessageActivity(userId) {
  requireUserId(userId);
  try {
    const { error } = await db().rpc("record_student_network_message_activity");
    if (error) {
      logFeatureError("rewards", error);
      return { error: error.message };
    }
    return { error: null };
  } catch (error) {
    return { error: error?.message || "Network activity sync unavailable." };
  }
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
    redeemedAt: row.redeemed_at,
    fulfilledAt: row.fulfilled_at || null,
    messageId: row.message_id || null,
    assignedMentorId: row.assigned_mentor_id || null,
    description: row.description || null,
    fulfillmentType: row.fulfillment_type || null,
    scope: row.scope || null,
    wordLimit: row.word_limit ?? null,
    exclusions: row.exclusions || null,
    mentorsRequired: row.mentors_required ?? 1,
    assignedMentorIds: row.assigned_mentor_ids || [],
    catalogSnapshot: row.catalog_snapshot || null
  };
}

export async function fulfillRewardRedemption(redemptionId) {
  try {
    const { data, error } = await db().rpc("fulfill_reward_redemption", {
      p_redemption_id: redemptionId
    });
    if (error) {
      logFeatureError("rewards", error);
      return { redemption: null, error: error.message };
    }
    if (data?.error) {
      return { redemption: null, error: data.error };
    }
    return {
      redemption: data?.redemption ? mapRewardRedemption(data.redemption) : null,
      alreadyFulfilled: Boolean(data?.already_fulfilled),
      error: null
    };
  } catch (error) {
    return { redemption: null, error: error?.message || "Could not mark reward fulfilled." };
  }
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

export async function getRewardShopOffers() {
  const { data, error } = await db().rpc("get_reward_shop_offers");
  if (error) {
    logFeatureError("rewards", error);
    return { offers: null, error: "Rewards are temporarily unavailable. Retry in a moment." };
  }
  return {
    offers: data
      ? {
          rewardIds: data.rewardIds || data.reward_ids || [],
          periodKey: data.periodKey || data.period_key,
          refreshAt: Number(data.refreshAt ?? data.refresh_at),
          featuredRewardId: data.featuredRewardId || data.featured_reward_id,
          featuredPeriodKey: data.featuredPeriodKey || data.featured_period_key,
          featuredRefreshAt: Number(data.featuredRefreshAt ?? data.featured_refresh_at)
        }
      : null,
    error: null
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
    if (/not currently available/i.test(message)) {
      return { error: "This reward is not available in today’s shop." };
    }
    if (/choose a selection|unknown reward/i.test(message) || error.code === "22023") {
      return { error: message.includes("selection") ? "Choose a selection for this reward." : "This reward is not available." };
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
