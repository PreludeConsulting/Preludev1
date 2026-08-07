import { z } from "zod";
import { readJsonBody, sendJson } from "./http.js";
import { assertDashboardAppDataOwnership } from "./lib/dataOwnership.js";
import { getSupabaseAdmin, requireSupabaseUser } from "./lib/supabaseRequestAuth.js";
import {
  evaluateMentorAccess,
  isLiveSessionBundleId
} from "../shared/mentorAccess.js";
import {
  formatAvailabilitySummary,
  syncMentorAvailabilityToStudentMatches
} from "../shared/mentorAvailabilitySync.js";

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

const availabilitySchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  days: z.array(z.object({
    dayOfWeek: z.string().trim().min(1).max(20),
    enabled: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/)
  }).superRefine((day, ctx) => {
    if (!day.enabled) return;
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${day.dayOfWeek}: end time must be after start time.`
      });
    }
  })).max(7)
});

function mapProfile(row, email) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || "",
    preferredName: row.preferred_name || "",
    email: row.email || email || "",
    school: row.school || "",
    grade: row.grade_level || "",
    graduationYear: row.graduation_year || "",
    gpa: row.gpa || "",
    weightedGpa: row.weighted_gpa || "",
    sat: row.sat || "",
    act: row.act || "",
    bio: row.bio || "",
    academicGoals: row.academic_goals || "",
    colleges: Array.isArray(row.college_interests) ? row.college_interests : [],
    majors: Array.isArray(row.target_majors) ? row.target_majors : [],
    mentorPreferences: row.mentor_preferences || {},
    avatarUrl: row.avatar_url || null,
    timeZone: row.time_zone || "",
    language: row.language || "",
    locationCityState: row.location_city_state || "",
    role: row.role || "student"
  };
}

function mapSettings(row) {
  if (!row) return { ...defaultSettings };
  const out = {};
  for (const field of settingFields) {
    const camel = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    out[camel] = row[field];
  }
  return out;
}

function mapAvailability(row) {
  const value = row?.availability_schedule;
  if (value && typeof value === "object" && Array.isArray(value.days)) return value;
  return { timezone: "ET", days: [] };
}

function mapRewards(wallet, tasks) {
  return {
    coins: Number(wallet?.coin_balance || 0),
    lifetimeEarned: Number(wallet?.lifetime_earned || 0),
    lifetimeClaimed: Number(wallet?.lifetime_claimed || 0),
    tasks: (tasks || []).map((task) => ({
      id: task.id,
      taskTemplateId: task.task_template_id,
      title: task.title,
      category: task.category,
      ownershipType: task.ownership_type,
      status: task.status,
      coins: Number(task.coin_value || 0),
      progressCurrent: Number(task.progress_current || 0),
      progressTarget: Number(task.progress_target || 1),
      completedAt: task.completed_at,
      claimedAt: task.claimed_at
    }))
  };
}

export function normalizeDashboardAppData({
  user,
  profile,
  settings,
  availability,
  wallet,
  tasks,
  notifications,
  events,
  messages,
  mentorAccess = null,
  featureErrors = []
}) {
  return {
    version: 1,
    user: { id: user.id, email: user.email || null, role: (user.user_metadata?.role || profile?.role || "student").toLowerCase() },
    profile: mapProfile(profile, user.email),
    settings: mapSettings(settings),
    availability: mapAvailability(availability),
    rewards: mapRewards(wallet, tasks),
    notifications: (notifications || []).map((item) => ({
      id: item.id, title: item.title, body: item.body, unread: Boolean(item.unread), link: item.link || null, createdAt: item.created_at
    })),
    events: events || [],
    messages: messages || [],
    mentorAccess,
    featureErrors
  };
}

async function loadAppData(supabase, user) {
  const [profileRes, settingsRes, availabilityRes, walletRes, tasksRes, notificationsRes, eventsRes, messagesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("mentor_matching_profiles").select("mentor_user_id,availability_schedule").eq("mentor_user_id", user.id).maybeSingle(),
    supabase.from("reward_wallets").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("reward_task_instances").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("calendar_events").select("*").eq("user_id", user.id).order("start_time", { ascending: true }),
    supabase.from("messages").select("*").or(`sender_id.eq.${user.id},receiver_id.eq.${user.id},user_id.eq.${user.id}`).order("created_at", { ascending: true })
  ]);
  const error = [profileRes, settingsRes, notificationsRes, eventsRes, messagesRes]
    .map((result) => result?.error)
    .find(Boolean);
  if (error) throw error;
  const featureErrors = [];
  if (availabilityRes.error) featureErrors.push("availability");
  if (walletRes.error || tasksRes.error) featureErrors.push("rewards");
  if (featureErrors.length) {
    console.error("[prelude-dashboard-features]", {
      userId: user.id,
      availability: availabilityRes.error || null,
      rewards: walletRes.error || tasksRes.error || null
    });
  }
  assertDashboardAppDataOwnership({
    userId: user.id,
    profile: profileRes.data,
    settings: settingsRes.data,
    availability: availabilityRes.error ? null : availabilityRes.data,
    wallet: walletRes.error ? null : walletRes.data,
    tasks: tasksRes.error ? [] : tasksRes.data,
    notifications: notificationsRes.data,
    events: eventsRes.data,
    messages: messagesRes.data
  });

  let mentorAccess = null;
  const profileRole = String(profileRes.data?.role || user.user_metadata?.role || "").toLowerCase();
  if (profileRole === "student" && profileRes.data) {
    try {
      mentorAccess = await loadStudentMentorAccess(supabase, profileRes.data);
    } catch (error) {
      // Soft-fail: Book a Session can fall back to billing summary / client eval.
      console.error("[prelude-dashboard] mentorAccess load failed", error?.message || error);
    }
  }

  return normalizeDashboardAppData({
    user,
    profile: profileRes.data,
    settings: settingsRes.data,
    availability: availabilityRes.data,
    wallet: walletRes.data,
    tasks: tasksRes.data,
    notifications: notificationsRes.data,
    events: eventsRes.data,
    messages: messagesRes.data,
    mentorAccess,
    featureErrors
  });
}

async function loadStudentMentorAccess(supabase, profile) {
  const studentUserId = profile.id;
  const now = Date.now();
  const [{ data: periodRows }, { data: packageRows }] = await Promise.all([
    supabase
      .from("subscription_session_periods")
      .select("*")
      .eq("student_user_id", studentUserId)
      .eq("status", "active")
      .order("period_start", { ascending: false }),
    supabase
      .from("session_package_purchases")
      .select("*")
      .eq("student_user_id", studentUserId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
  ]);

  const periods = Array.isArray(periodRows) ? periodRows : periodRows ? [periodRows] : [];
  const period = periods.find((row) => {
    if (!row?.period_end) return true;
    const end = new Date(row.period_end).getTime();
    return !Number.isNaN(end) && end > now;
  }) || null;
  const sessionCredits = period
    ? {
        allowance: Math.max(0, Number(period.allowance) || 0),
        remaining: Math.max(0, Number(period.remaining) || 0),
        used: Math.max(0, (Number(period.allowance) || 0) - (Number(period.remaining) || 0)),
        active: String(period.status || "").toLowerCase() === "active",
        periodEnd: period.period_end || null,
        planId: period.plan_id || null
      }
    : { allowance: 0, remaining: 0, used: 0, active: false, periodEnd: null, planId: null };

  const packages = (packageRows || [])
    .map((row) => ({
      id: row.id,
      studentUserId: row.student_user_id,
      mentorUserId: row.mentor_user_id ?? null,
      bundleId: row.bundle_id || "flexible_sessions",
      sessionsPurchased: Number(row.sessions_purchased) || 0,
      sessionsRemaining: Number(row.sessions_remaining) || 0,
      status: row.status || "active",
      expiresAt: row.expires_at ?? null
    }))
    .filter((pkg) => isLiveSessionBundleId(pkg.bundleId));

  const access = evaluateMentorAccess({
    user: {
      id: studentUserId,
      plan: profile.plan_id || "basic",
      subscriptionStatus: profile.subscription_status,
      subscriptionCurrentPeriodEnd: profile.entitlement_ends_at || profile.subscription_current_period_end,
      entitlementEndsAt: profile.entitlement_ends_at || profile.subscription_current_period_end,
      promoAccessEndsAt: profile.promo_access_ends_at
    },
    packages,
    sessionCredits
  });

  return {
    allowed: access.allowed,
    accessType: access.accessType,
    remainingSessions: access.remainingSessions,
    subscriptionRemaining: access.subscriptionRemaining,
    packageRemaining: access.packageRemaining,
    allowance: access.allowance,
    periodEnd: access.periodEnd,
    sessionCreditBalanceLabel: access.sessionCreditBalanceLabel,
    reason: access.reason,
    dailyBookingUsed: access.dailyBookingUsed === true
  };
}

function pickFields(body, allowed) {
  return Object.fromEntries(Object.entries(body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined));
}

async function requireMentorProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (String(data?.role || "").toLowerCase() !== "mentor") {
    const forbidden = new Error("Mentor access required.");
    forbidden.statusCode = 403;
    throw forbidden;
  }
}

export function createSupabaseDashboardApiMiddleware({
  requireUser = requireSupabaseUser,
  getAdminClient = getSupabaseAdmin
} = {}) {
  return async function supabaseDashboardApi(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const isAppData = url.pathname === "/api/dashboard/app-data" && req.method === "GET";
    const isProfile = url.pathname === "/api/dashboard/profile" && req.method === "PATCH";
    const isSettings = url.pathname === "/api/dashboard/settings" && req.method === "PATCH";
    const isAvailability = url.pathname === "/api/dashboard/availability" && req.method === "PUT";
    if (!isAppData && !isProfile && !isSettings && !isAvailability) return next();
    // Leave cookie-authenticated legacy/demo sessions to the existing Prisma
    // dashboard middleware; Supabase routes are selected by bearer auth.
    if (!req.headers.authorization?.trim()) return next();

    try {
      const { supabase, user } = await requireUser(req);
      if (isAppData) return sendJson(res, 200, await loadAppData(supabase, user));

      const body = await readJsonBody(req);
      if (isProfile) {
        const { data, error } = await supabase.from("profiles").update({ ...pickFields(body, profileFields), updated_at: new Date().toISOString() }).eq("id", user.id).select().maybeSingle();
        if (error) throw error;
        if (!data) {
          const notFound = new Error("Profile was not found; nothing was saved.");
          notFound.statusCode = 409;
          throw notFound;
        }
        return sendJson(res, 200, { profile: mapProfile(data, user.email) });
      }
      if (isSettings) {
        const { data, error } = await supabase.from("user_settings").upsert({ user_id: user.id, ...pickFields(body, settingFields), updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select().maybeSingle();
        if (error) throw error;
        if (!data) {
          const notFound = new Error("Settings were not returned by the server; nothing was saved.");
          notFound.statusCode = 409;
          throw notFound;
        }
        return sendJson(res, 200, { settings: mapSettings(data) });
      }

      await requireMentorProfile(supabase, user.id);
      const availability = availabilitySchema.parse(body);
      const availabilitySummary = formatAvailabilitySummary(availability);
      const admin = getAdminClient();
      if (!admin) {
        const configError = new Error("Availability sync requires service role configuration.");
        configError.statusCode = 503;
        throw configError;
      }

      const { data, error } = await admin
        .from("mentor_matching_profiles")
        .upsert(
          {
            mentor_user_id: user.id,
            availability_schedule: availability,
            ...(availabilitySummary ? { availability: availabilitySummary } : {}),
            updated_at: new Date().toISOString()
          },
          { onConflict: "mentor_user_id" }
        )
        .select("availability_schedule")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const notFound = new Error("Availability was not returned by the server; nothing was saved.");
        notFound.statusCode = 409;
        throw notFound;
      }

      if (availabilitySummary) {
        const { data: questionnaire } = await admin
          .from("mentor_questionnaires")
          .select("answers")
          .eq("user_id", user.id)
          .maybeSingle();
        if (questionnaire) {
          const answers = {
            ...(questionnaire.answers && typeof questionnaire.answers === "object" ? questionnaire.answers : {}),
            availability: availabilitySummary
          };
          await admin
            .from("mentor_questionnaires")
            .update({ answers, updated_at: new Date().toISOString() })
            .eq("user_id", user.id);
        }
      }

      await syncMentorAvailabilityToStudentMatches(admin, user.id, availabilitySummary);

      return sendJson(res, 200, { availability: mapAvailability(data) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstIssue = error.issues?.[0]?.message;
        return sendJson(res, 400, {
          error: "validation_error",
          message: firstIssue || "Invalid availability times.",
          issues: error.issues
        });
      }
      const status = Number(error?.statusCode) || 500;
      if (status >= 500) console.error("[prelude-dashboard-sync]", error);
      const rawMessage = String(error?.message || "");
      const safeServerMessage = "Dashboard data is temporarily unavailable. Retry in a moment.";
      return sendJson(res, status, {
        error: status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "dashboard_sync_failed",
        message: status === 401
          ? "Sign in again to continue."
          : status === 403
            ? error.message || "You do not have access to this dashboard data."
            : status >= 500
              ? safeServerMessage
              : rawMessage || safeServerMessage
      });
    }
  };
}

export default createSupabaseDashboardApiMiddleware();
