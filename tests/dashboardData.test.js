import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../src/dashboard/lib/dashboardPreferences.js";
import { defaultLocalDashboardStore } from "../src/dashboard/lib/localDashboardStore.js";
import { mapScholarship, mapSettings } from "../src/lib/dashboardData.js";

describe("dashboard preferences", () => {
  it("includes synced notification, appearance, and privacy defaults", () => {
    expect(DEFAULT_PREFERENCES).toMatchObject({
      deadlineReminders: true,
      progressReminders: true,
      rewardUpdates: true,
      digestFrequency: "weekly",
      quietHoursEnabled: false,
      theme: "system",
      hapticFeedback: true,
      profileVisibility: "mentors_only"
    });
  });

  it("keeps local fallback storage ready for scholarships", () => {
    expect(defaultLocalDashboardStore()).toMatchObject({
      scholarships: []
    });
  });
});

describe("dashboard data mappers", () => {
  it("maps expanded user settings columns", () => {
    expect(mapSettings({
      email_updates: true,
      meeting_reminders: true,
      mentor_messages: false,
      student_messages: true,
      deadline_reminders: true,
      progress_reminders: false,
      reward_updates: true,
      parent_summaries: false,
      notification_sounds: true,
      interface_sounds: false,
      weekly_digest: true,
      digest_frequency: "daily",
      quiet_hours_enabled: true,
      quiet_hours_start: "20:30",
      quiet_hours_end: "06:45",
      product_tips: false,
      default_calendar_view: "week",
      reminder_lead_time: "60",
      week_start: "monday",
      density: "compact",
      reduce_motion: true,
      haptic_feedback: false,
      profile_visibility: "private",
      theme: "dark",
      data_export_requested_at: "2026-06-30T12:00:00.000Z"
    })).toMatchObject({
      studentMessages: true,
      deadlineReminders: true,
      progressReminders: false,
      rewardUpdates: true,
      digestFrequency: "daily",
      quietHoursEnabled: true,
      quietHoursStart: "20:30",
      quietHoursEnd: "06:45",
      hapticFeedback: false,
      profileVisibility: "private",
      theme: "dark"
    });
  });

  it("normalizes scholarship rows for the workspace tracker", () => {
    expect(mapScholarship({
      id: "sch-1",
      name: "Local Rotary Scholarship",
      amount: "2500",
      deadline: "2026-11-01",
      required_materials: ["Essay", "Transcript"],
      essay_required: true,
      recommendation_required: false,
      status: "Preparing",
      notes: "Ask counselor for transcript.",
      created_at: "2026-06-30T12:00:00.000Z",
      updated_at: "2026-06-30T12:00:00.000Z"
    })).toMatchObject({
      id: "sch-1",
      name: "Local Rotary Scholarship",
      amount: 2500,
      requiredMaterials: ["Essay", "Transcript"],
      essayRequired: true,
      recommendationRequired: false,
      status: "Preparing"
    });
  });
});
