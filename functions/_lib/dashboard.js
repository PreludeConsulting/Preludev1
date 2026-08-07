import { formatAvailabilitySummary } from "../../shared/mentorAvailabilitySync.js";
import { evaluateMentorAccess, isLiveSessionBundleId } from "../../shared/mentorAccess.js";
import { adminRest, first, httpError, json, requireUser, rest } from "./http.js";
import { loadMeetingsForUser, sanitizeMeetingForRole } from "./meetings.js";
import { DEFAULT_INTEGRATIONS, normalizeIntegrations } from "./integrations.js";
import { ensureSessionPeriodFromProfile, summarizeSessionPeriodRow, wrapAdminRestForSessionPeriods } from "./sessionPeriodCredits.js";
import { normalizePlanId, ACTIVE_SUBSCRIPTION_STATUSES } from "../../shared/mentorAccess.js";
import { shouldInitializeSessionPeriodForSubscription } from "../../shared/sessionPeriodEnsure.js";

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

function ensureDashboardOwnership(user, { profile, settings, availability, wallet }) {
  ensureOwnedRow(profile, user.id, ["id"], "Profile data");
  ensureOwnedRow(settings, user.id, ["user_id"], "Settings data");
  ensureOwnedRow(availability, user.id, ["mentor_user_id"], "Availability data");
  ensureOwnedRow(wallet, user.id, ["user_id"], "Reward wallet data");
}

function mapLiveSessionPackage(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    mentorUserId: row.mentor_user_id ?? null,
    bundleId: row.bundle_id || "flexible_sessions",
    sessionsPurchased: Number(row.sessions_purchased) || 0,
    sessionsRemaining: Number(row.sessions_remaining) || 0,
    status: row.status || "active",
    expiresAt: row.expires_at ?? null
  };
}

function summarizeActiveSessionPeriod(period) {
  return summarizeSessionPeriodRow(period);
}

/**
 * Book a Session source of truth for Cloudflare production (mirrors Node canRequestMentor).
 * Session credits and live packages are evaluated separately from Essay Support review credits.
 */
async function loadStudentMentorAccess(context, profile, meetings = []) {
  if (!profile || String(profile.role || "").toLowerCase() !== "student") return null;
  const studentUserId = profile.id;
  const nowIso = new Date().toISOString();
  let sessionCredits = summarizeActiveSessionPeriod(null);
  let packages = [];
  try {
    const periodRest = wrapAdminRestForSessionPeriods(adminRest);
    await ensureSessionPeriodFromProfile(periodRest, context, profile);

    let periodRows = await adminRest(
      context,
      `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&period_end=gt.${encodeURIComponent(nowIso)}&select=*&order=period_start.desc&limit=1`
    );
    // Stuck Active Plus/Pro with no ledger row (common when period bounds were
    // never persisted): pull Stripe and open period #1 now.
    if (!first(periodRows)) {
      const planId = normalizePlanId(profile.plan_id);
      const status = String(profile.subscription_status || "").trim().toLowerCase();
      const statusForInit =
        status === "complete" || status === "checkout_completed" ? "active" : status;
      const needsStripeHeal =
        (planId === "plus" || planId === "pro") && ACTIVE_SUBSCRIPTION_STATUSES.has(statusForInit);
      if (needsStripeHeal) {
        try {
          const {
            pullAndSyncSubscriptionCredits,
            resolveStudentStripeSubscriptionId
          } = await import("./stripeBilling.js");
          const subId = await resolveStudentStripeSubscriptionId(context, profile);
          if (subId) {
            await pullAndSyncSubscriptionCredits(context, subId, {
              userId: studentUserId,
              planId
            });
          } else {
            console.error("[prelude-dashboard-worker] session-period heal: no Stripe subscription id", {
              studentUserId,
              hasCustomerId: Boolean(profile.stripe_customer_id)
            });
          }
          // Re-ensure from (possibly updated) profile fields, then re-read ledger.
          const refreshed = first(
            await adminRest(
              context,
              `profiles?id=eq.${encodeURIComponent(studentUserId)}&select=id,plan_id,subscription_status,subscription_current_period_start,subscription_current_period_end,entitlement_ends_at,stripe_subscription_id,stripe_customer_id&limit=1`
            )
          );
          if (refreshed) {
            await ensureSessionPeriodFromProfile(periodRest, context, refreshed);
          }
          periodRows = await adminRest(
            context,
            `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&period_end=gt.${encodeURIComponent(nowIso)}&select=*&order=period_start.desc&limit=1`
          );
        } catch (healError) {
          console.error(
            "[prelude-dashboard-worker] stripe session-period heal failed",
            healError?.message || healError
          );
        }
      } else if (
        shouldInitializeSessionPeriodForSubscription({
          subscriptionStatus: statusForInit,
          planId,
          periodStartIso: profile.subscription_current_period_start,
          periodEndIso: profile.entitlement_ends_at || profile.subscription_current_period_end
        })
      ) {
        await ensureSessionPeriodFromProfile(periodRest, context, profile);
        periodRows = await adminRest(
          context,
          `subscription_session_periods?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&period_end=gt.${encodeURIComponent(nowIso)}&select=*&order=period_start.desc&limit=1`
        );
      }
    }

    const packageRows = await adminRest(
      context,
      `session_package_purchases?student_user_id=eq.${encodeURIComponent(studentUserId)}&status=eq.active&select=*&order=created_at.asc`
    );
    sessionCredits = summarizeActiveSessionPeriod(first(periodRows));
    packages = (packageRows || [])
      .map(mapLiveSessionPackage)
      .filter((pkg) => pkg && isLiveSessionBundleId(pkg.bundleId));
  } catch (error) {
    console.error("[prelude-dashboard-worker] mentorAccess load failed", error?.message || error);
  }

  const accessUser = {
    id: studentUserId,
    plan: profile.plan_id || "basic",
    subscriptionStatus: profile.subscription_status,
    subscriptionCurrentPeriodEnd: profile.entitlement_ends_at || profile.subscription_current_period_end,
    entitlementEndsAt: profile.entitlement_ends_at || profile.subscription_current_period_end,
    promoAccessEndsAt: profile.promo_access_ends_at
  };
  const access = evaluateMentorAccess({
    user: accessUser,
    meetings,
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
    dailyBookingUsed: access.dailyBookingUsed === true,
    sessionCreditsActive: Boolean(sessionCredits?.active)
  };
}

async function loadAppData(context, user, token) {
  const uid = encodeURIComponent(user.id);
  const query = (table, suffix) => rest(context, token, `${table}?${suffix}`);
  const requests = await Promise.allSettled([
    query("profiles", `select=*&id=eq.${uid}&limit=1`),
    query("user_settings", `select=*&user_id=eq.${uid}&limit=1`),
    adminRest(context, `mentor_matching_profiles?select=mentor_user_id,availability_schedule&mentor_user_id=eq.${uid}&limit=1`),
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
  // Collection payloads (events/messages/notifications/tasks) are already scoped by
  // the REST filters + Supabase RLS. Do not hard-fail app-data when a linked-student
  // calendar/message row is visible to a mentor/parent — that previously 403'd the
  // whole Cloudflare dashboard boot.
  ensureDashboardOwnership(user, {
    profile: first(profile.value),
    settings: first(settings.value),
    availability: availability.status === "fulfilled" ? first(availability.value) : null,
    wallet: wallet.status === "fulfilled" ? first(wallet.value) : null
  });

  const resolvedRole = (user.user_metadata?.role || first(profile.value)?.role || "student").toLowerCase();
  const taskRows = tasks.status === "fulfilled" ? tasks.value : [];
  const notificationRows = notifications.value || [];
  const eventRows = events.value || [];
  const messageRows = messages.value || [];

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

  const profileRow = first(profile.value);
  let mentorAccess = null;
  if (String(resolvedRole) === "student" || String(profileRow?.role || "").toLowerCase() === "student") {
    try {
      mentorAccess = await loadStudentMentorAccess(context, profileRow, meetings);
    } catch (error) {
      console.error("[prelude-dashboard-worker] mentorAccess evaluate failed", error?.message || error);
      featureErrors.push("mentorAccess");
    }
  }

  return {
    version: 1,
    user: { id: user.id, email: user.email || null, role: resolvedRole },
    profile: mapProfile(profileRow, user.email),
    settings: mapSettings(first(settings.value)),
    availability: mapAvailability(availability.status === "fulfilled" ? first(availability.value) : null),
    mentorIdentity: {
      hasProfile: availability.status === "fulfilled" && first(availability.value)?.mentor_user_id === user.id
    },
    rewards: mapRewards(wallet.status === "fulfilled" ? first(wallet.value) : null, taskRows),
    notifications: notificationRows.map((item) => ({
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
    events: eventRows,
    messages: messageRows,
    meetings,
    integrations,
    mentorAccess,
    featureErrors
  };
}

function validateAvailability(value) {
  if (!value || typeof value.timezone !== "string" || !Array.isArray(value.days) || value.days.length > 7) {
    return { ok: false, message: "Check the availability times and retry." };
  }
  for (const day of value.days) {
    if (
      typeof day.dayOfWeek !== "string" ||
      typeof day.enabled !== "boolean" ||
      !/^\d{2}:\d{2}$/.test(day.startTime) ||
      !/^\d{2}:\d{2}$/.test(day.endTime)
    ) {
      return { ok: false, message: "Check the availability times and retry." };
    }
    if (!day.enabled) continue;
    const [sh, sm] = day.startTime.split(":").map(Number);
    const [eh, em] = day.endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      return { ok: false, message: `${day.dayOfWeek}: end time must be after start time.` };
    }
  }
  return { ok: true };
}

async function requireMentorProfile(context, user) {
  const rows = await adminRest(
    context,
    `mentor_matching_profiles?select=mentor_user_id&mentor_user_id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  if (first(rows)?.mentor_user_id !== user.id) {
    throw httpError("No mentor profile is associated with this account.", 403, "mentor_profile_required");
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
      const validation = validateAvailability(body);
      if (!validation.ok) return json({ error: "validation_error", message: validation.message }, 400);
      await requireMentorProfile(context, user);
      const availabilitySummary = formatAvailabilitySummary(body);
      const rows = await adminRest(context, `mentor_matching_profiles?mentor_user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
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
        await adminRest(
          context,
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
      error: status === 401
        ? "unauthenticated"
        : status === 403
          ? (error?.code || "forbidden")
          : "dashboard_sync_failed",
      message: status === 401
        ? "Sign in again to continue."
        : status === 403
          ? error.message || "You do not have access to this dashboard data."
          : error.message || "Dashboard data is temporarily unavailable. Retry in a moment."
    }, status);
  }
}
