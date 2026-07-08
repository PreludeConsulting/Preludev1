import { describe, expect, it } from "vitest";
import {
  canSubmitParentInvite,
  getDisplaySettings,
  getIntegrationCards,
  getNotificationGroups,
  isValidParentInviteEmail
} from "../src/dashboard/lib/settingsExperience.js";
import {
  getTrustedDeviceFingerprint,
  getTrustedDeviceSections
} from "../src/dashboard/lib/trustedDevices.js";

describe("settings experience model", () => {
  it("keeps display settings focused on working controls and removes theme selection", () => {
    const settings = getDisplaySettings();
    const ids = settings.map((setting) => setting.id);

    expect(ids).not.toContain("theme");
    expect(ids).toEqual(["density", "reduceMotion", "interfaceSounds", "hapticFeedback"]);
  });

  it("groups notifications into a short useful set", () => {
    const groups = getNotificationGroups("student");
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(groups.map((group) => group.title)).toEqual([
      "Essential notifications",
      "Student progress",
      "Quiet hours"
    ]);
    expect(labels).toEqual([
      "Product & account emails",
      "Security alerts",
      "Meeting reminders",
      "Deadline reminders",
      "Mentor messages",
      "Progress digest",
      "Quiet hours"
    ]);
  });

  it("shows unavailable integrations honestly instead of broken connect buttons", () => {
    const cards = getIntegrationCards({
      googleCalendar: { connected: false },
      zoom: { connected: false }
    });

    expect(cards).toEqual([
      expect.objectContaining({
        id: "googleCalendar",
        status: "Setup required",
        actionLabel: "Coming soon",
        available: false
      }),
      expect.objectContaining({
        id: "zoom",
        status: "Setup required",
        actionLabel: "Coming soon",
        available: false
      })
    ]);
  });

  it("validates parent invite email before enabling submit", () => {
    expect(isValidParentInviteEmail("parent@example.com")).toBe(true);
    expect(isValidParentInviteEmail("bad-email")).toBe(false);
    expect(canSubmitParentInvite({ email: "parent@example.com", loading: false })).toBe(true);
    expect(canSubmitParentInvite({ email: "parent@example.com", loading: true })).toBe(false);
  });
});

describe("trusted device presentation", () => {
  it("hides revoked and expired devices and dedupes active devices by useful identity", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    const sections = getTrustedDeviceSections([
      {
        id: "old-active",
        device_name: "Chrome on macOS",
        user_agent_summary: "Chrome on macOS",
        created_at: "2026-07-01T12:00:00.000Z",
        last_used_at: "2026-07-06T12:00:00.000Z",
        expires_at: "2026-08-01T12:00:00.000Z",
        revoked_at: null
      },
      {
        id: "new-active",
        device_name: "Chrome on macOS",
        user_agent_summary: "Chrome on macOS",
        created_at: "2026-07-02T12:00:00.000Z",
        last_used_at: "2026-07-08T11:00:00.000Z",
        expires_at: "2026-08-02T12:00:00.000Z",
        revoked_at: null
      },
      {
        id: "revoked",
        device_name: "Safari on iPhone",
        user_agent_summary: "Safari on iOS",
        created_at: "2026-07-02T12:00:00.000Z",
        last_used_at: "2026-07-03T12:00:00.000Z",
        expires_at: "2026-08-02T12:00:00.000Z",
        revoked_at: "2026-07-04T12:00:00.000Z"
      },
      {
        id: "expired",
        device_name: "Firefox on Windows",
        user_agent_summary: "Firefox on Windows",
        created_at: "2026-06-01T12:00:00.000Z",
        last_used_at: "2026-06-02T12:00:00.000Z",
        expires_at: "2026-07-01T12:00:00.000Z",
        revoked_at: null
      }
    ], { now, currentDeviceId: "new-active" });

    expect(sections.active).toHaveLength(1);
    expect(sections.active[0]).toEqual(expect.objectContaining({
      id: "new-active",
      label: "Chrome on macOS",
      current: true
    }));
    expect(sections.revoked).toHaveLength(1);
    expect(sections.revoked[0].id).toBe("revoked");
  });

  it("uses browser and OS summary as the fingerprint fallback", () => {
    expect(getTrustedDeviceFingerprint({
      device_name: "",
      user_agent_summary: "Chrome on macOS"
    })).toBe("chrome on macos");
  });
});
