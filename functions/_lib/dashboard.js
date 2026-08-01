import { formatAvailabilitySummary } from "../../shared/mentorAvailabilitySync.js";
import { first, httpError, json, requireUser, rest } from "./http.js";
import { loadMeetingsForUser, sanitizeMeetingForRole } from "./meetings.js";
import { DEFAULT_INTEGRATIONS, normalizeIntegrations } from "./integrations.js";

const profileFields = [
  "full_name", "preferred_name", "school", "grade_level", "time_zone", "language",
  "location_city_state", "bio", "academic_goals", "college_interests", "mentor_preferences",
  "graduation_year", "gpa", "weighted_gpa", "sat", "act", "target_majors", "avatar_url"
];

const settingFields = [
  "email_updates", "meeting_reminders", "mentor_messages", "student_messages", "deadline_reminders",
  "progress_reminders", "reward_updates", "essay_comments", "college_application_updates",
  "scholarship_reminders", "parent_summaries", "notification_sounds", "interface_sounds", "weekly_digest",
  "digest_frequency", "quiet_hours_enabled", "quiet_hours_start", "quiet_hours_end", "product_tips",
  "default_calendar_view", "reminder_lead_time", "week_start", "density", "reduce_motion", "haptic_feedback",
  "profile_visibility", "theme"
];

const defaultSettings = {
  emailUpdates: true, meetingReminders: true, mentorMessages: true, studentMessages: true,
  deadlineReminders: true, progressReminders: true, rewardUpdates: true, essayComments: true,
  collegeApplicationUpdates: true, scholarshipReminders: true, parentSummaries: false,
  notificationSounds: true, interfaceSounds: true, weeklyDigest: false, digestFrequency: "weekly",
  quietHoursEnabled: false, quietHoursStart: "21:00", quietHoursEnd: "07:00", productTips: false,
  defaultCalendarView: "month", reminderLeadTime: "30", weekStart: "sunday", density: "comfortable",
  reduceMotion: false, hapticFeedback: true, profileVisibility: "mentors_only", theme: "system"
};

const pickFields = (body, allowed) => Object.fromEntries(
  Object.entries(body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined)
);

function mapProfile(row, email) {
  if (!row) return null;
  return {
    id: row.id, fullName: row.full_name || "", preferredName: row.preferred_name || "",
    email: row.email || email || "", school: row.school || "", grade: row.grade_level || "",
    graduationYear: row.graduation_year || "", gpa: row.gpa || "", weightedGpa: row.weighted_gpa || "",
    sat: row.sat || "", act: row.act || "", bio: row.bio || "", academicGoals: row.academic_goals || "",
    colleges: Array.isArray(row.college_interests) ? row.college_interests : [],
    majors: Array.isArray(row.target_majors) ? row.target_majors : [], mentorPreferences: row.mentor_preferences || {},
    avatarUrl: row.avatar_url || null, timeZone: row.time_zone || "", language: row.language || "",
    locationCityState: row.location_city_state || "", role: row.role || "student"
  };
}

function mapSettings(row) {
  if (!row) return { ...defaultSettings };
  const mapped = {};
  for (const field of settingFields) mapped[field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = row[field];
  return mapped;
}

function mapAvailability(row) {
  const value = row?.availability_schedule;
  return value && typeof value === "object" && Array.isArray(value.days)
    ? value
    : { timezone: "ET", days: [] };
}

function mapRewards(wallet, tasks) {
  return {
    coins: Number(wallet?.coin_balance || 0),
    lifetimeEarned: Number(wallet?.lifetime_earned || 0),
    lifetimeClaimed: Number(wallet?.lifetime_claimed || 0),
    tasks: (tasks || []).map((task) => ({
      id: task.id, taskTemplateId: task.task_template_id, title: task.title, category: task.category,
      ownershipType: task.ownership_type, status: task.status, coins: Number(task.coin_value || 0),
      progressCurrent: Number(task.progress_current || 0), progressTarget: Number(task.progress_target || 1),
      completedAt: task.completed_at, claimedAt: task.claimed_at
    }))
  };
}

function ensureOwnedRow(row, userId, fields, label) {
  if (!row) return;
  if (!fields.some((field) => row[field] === userId)) {
    throw httpError(`${label} does not belong to this account.`, 403, "forbidden");
  }
}

function ensureDashboardOwnership(user, { profile, settings, availability, wallet, tasks, notifications, events, messages }) {
  ensureOwnedRow(profile, user.id, ["id"], "Profile data");
  ensureOwnedRow(settings, user.id, ["user_id"], "Settings data");
  ensureOwnedRow(availability, user.id, ["mentor_user_id"], "Availability data");
  ensureOwnedRow(wallet, user.id, ["user_id"], "Reward wallet data");
  for (const row of tasks || []) ensureOwnedRow(row, user.id, ["user_id"], "Reward task data");
  for (const row of notifications || []) ensureOwnedRow(row, user.id, ["user_id"], "Notification data");
  for (const row of events || []) ensureOwnedRow(row, user.id, ["user_id"], "Calendar data");
  for (const row of messages || []) ensureOwnedRow(row, user.id, ["user_id", "sender_id", "receiver_id"], "Message data");
}

async function loadAppData(context, user, token) {
  const uid = encodeURIComponent(user.id);
  const query = (table, suffix) => rest(context, token, `${table}?${suffix}`);
  const requests = await Promise.allSettled([
    query("profiles", `select=*&id=eq.${uid}&limit=1`),
    query("user_settings", `select=*&user_id=eq.${uid}&limit=1`),
    query("mentor_matching_profiles", `select=availability_schedule&mentor_user_id=eq.${uid}&limit=1`),
    query("reward_wallets", `select=*&user_id=eq.${uid}&limit=1`),
    query("reward_task_instances", `select=*&user_id=eq.${uid}&order=created_at.desc`),
    query("notifications", `select=*&user_id=eq.${uid}&order=created_at.desc`),
    query("calendar_events", `select=*&user_id=eq.${uid}&order=start_time.asc`),
    query("messages", `select=*&or=${encodeURIComponent(`(sender_id.eq.${user.id},receiver_id.eq.${user.id},user_id.eq.${user.id})`)}&order=created_at.asc`)
  ]);
  const [profile, settings, availability, wallet, tasks, notifications, events, messages] = requests;
  for (const result of [profile, settings, notifications, events, messages]) {
    if (result.status === "rejected") throw result.reason;
  }
  const featureErrors = [];
  if (availability.status === "rejected") featureErrors.push("availability");
  if (wallet.status === "rejected" || tasks.status === "rejected") featureErrors.push("rewards");
  ensureDashboardOwnership(user, {
    profile: first(profile.value),
    settings: first(settings.value),
    availability: availability.status === "fulfilled" ? first(availability.value) : null,
    wallet: wallet.status === "fulfilled" ? first(wallet.value) : null,
    tasks: tasks.status === "fulfilled" ? tasks.value : [],
    notifications: notifications.value || [],
    events: events.value || [],
    messages: messages.value || []
  });

  const resolvedRole = (user.user_metadata?.role || first(profile.value)?.role || "student").toLowerCase();

  let meetings = [];
  try {
    meetings = (await loadMeetingsForUser(context, token, user.id, resolvedRole)).map((meeting) =>
      sanitizeMeetingForRole(meeting, resolvedRole)
    );
  } catch {
    featureErrors.push("meetings");
  }

  let integrations = DEFAULT_INTEGRATIONS();
  try {
    integrations = normalizeIntegrations(first(settings.value)?.integrations);
  } catch {
    featureErrors.push("integrations");
  }

  return {
    version: 1,
    user: { id: user.id, email: user.email || null, role: resolvedRole },
    profile: mapProfile(first(profile.value), user.email),
    settings: mapSettings(first(settings.value)),
    availability: mapAvailability(availability.status === "fulfilled" ? first(availability.value) : null),
    rewards: mapRewards(wallet.status === "fulfilled" ? first(wallet.value) : null, tasks.status === "fulfilled" ? tasks.value : []),
    notifications: (notifications.value || []).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      unread: Boolean(item.unread),
      link: item.link || null,
      createdAt: item.created_at,
      actionType: item.action_type || null,
      actionPayload: item.action_payload || {},
      actionCompletedAt: item.action_completed_at || null
    })),
    events: events.value || [],
    messages: messages.value || [],
    meetings,
    integrations,
    featureErrors
  };
}

function validateAvailability(value) {
  if (!value || typeof value.timezone !== "string" || !Array.isArray(value.days) || value.days.length > 7) return false;
  return value.days.every((day) =>
    typeof day.dayOfWeek === "string" && typeof day.enabled === "boolean" &&
    /^\d{2}:\d{2}$/.test(day.startTime) && /^\d{2}:\d{2}$/.test(day.endTime)
  );
}

async function requireMentorProfile(context, user, token) {
  const rows = await rest(
    context,
    token,
    `profiles?select=id,role&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const profile = first(rows);
  if (!profile || profile.id !== user.id || String(profile.role || "").toLowerCase() !== "mentor") {
    throw httpError("Mentor access required.", 403, "forbidden");
  }
}

export async function handleDashboard(context, action) {
  try {
    const { user, token } = await requireUser(context);
    if (action === "app-data") {
      if (context.request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      return json(await loadAppData(context, user, token));
    }
    const body = await context.request.json().catch(() => ({}));
    const now = new Date().toISOString();
    if (action === "profile" && context.request.method === "PATCH") {
      const rows = await rest(context, token, `profiles?id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH", body: JSON.stringify({ ...pickFields(body, profileFields), updated_at: now })
      });
      const row = first(rows);
      if (!row) return json({ error: "dashboard_sync_failed", message: "Profile could not be saved. Refresh and retry." }, 409);
      return json({ profile: mapProfile(row, user.email) });
    }
    if (action === "settings" && context.request.method === "PATCH") {
      const rows = await rest(context, token, "user_settings?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ user_id: user.id, ...pickFields(body, settingFields), updated_at: now })
      });
      const row = first(rows);
      if (!row) return json({ error: "dashboard_sync_failed", message: "Settings could not be saved. Refresh and retry." }, 409);
      return json({ settings: mapSettings(row) });
    }
    if (action === "availability" && context.request.method === "PUT") {
      if (!validateAvailability(body)) return json({ error: "validation_error", message: "Check the availability times and retry." }, 400);
      await requireMentorProfile(context, user, token);
      const availabilitySummary = formatAvailabilitySummary(body);
      const rows = await rest(context, token, "mentor_matching_profiles?on_conflict=mentor_user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          mentor_user_id: user.id,
          availability_schedule: body,
          ...(availabilitySummary ? { availability: availabilitySummary } : {}),
          updated_at: now
        })
      });
      const row = first(rows);
      if (!row) return json({ error: "dashboard_sync_failed", message: "Availability could not be saved. Refresh and retry." }, 409);

      // Best-effort: keep student match cards / summaries aligned with the live schedule.
      try {
        await rest(
          context,
          token,
          `mentor_matches?mentor_id=eq.${encodeURIComponent(user.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              availability: availabilitySummary,
              updated_at: now
            })
          }
        );
      } catch (syncError) {
        console.error("[prelude-dashboard-worker] mentor_matches availability sync failed", syncError?.message || syncError);
      }

      return json({ availability: mapAvailability(row) });
    }
    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[prelude-dashboard-worker]", { action, message: error?.message, details: error?.details });
    return json({
      error: status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "dashboard_sync_failed",
      message: status === 401
        ? "Sign in again to continue."
        : status === 403
          ? error.message || "You do not have access to this dashboard data."
          : "Dashboard data is temporarily unavailable. Retry in a moment."
    }, status);
  }
}
