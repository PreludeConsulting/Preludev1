import { describe, expect, it } from "vitest";
import { validateWeeklyFormState } from "../src/dashboard/lib/mentorAvailability.js";

describe("mentor availability form validation", () => {
  it("requires at least one enabled day", () => {
    expect(
      validateWeeklyFormState({
        timezone: "ET",
        days: [
          { dayOfWeek: "Monday", enabled: false, startTime: "09:00", endTime: "17:00" },
          { dayOfWeek: "Tuesday", enabled: false, startTime: "09:00", endTime: "17:00" }
        ]
      })
    ).toMatch(/at least one available day/i);
  });

  it("rejects enabled days where end is not after start", () => {
    expect(
      validateWeeklyFormState({
        timezone: "ET",
        days: [
          { dayOfWeek: "Monday", enabled: true, startTime: "17:00", endTime: "09:00" }
        ]
      })
    ).toMatch(/end time must be after start time/i);
  });

  it("ignores default times on disabled days", () => {
    expect(
      validateWeeklyFormState({
        timezone: "PT",
        days: [
          { dayOfWeek: "Monday", enabled: true, startTime: "09:00", endTime: "12:00" },
          { dayOfWeek: "Tuesday", enabled: false, startTime: "17:00", endTime: "09:00" }
        ]
      })
    ).toBe("");
  });
});
