import { describe, expect, it } from "vitest";
import {
  buildOneHourSlotsForWindow,
  buildSlotsForDate,
  listBookableDates,
  validateMentorBookingSlot,
  zonedDateTimeToUtc
} from "../shared/mentorBookingSlots.js";

const schedule = {
  timezone: "ET",
  days: [
    { dayOfWeek: "Monday", enabled: true, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: "Tuesday", enabled: true, startTime: "14:00", endTime: "17:00" },
    { dayOfWeek: "Wednesday", enabled: false, startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "Thursday", enabled: false, startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "Friday", enabled: false, startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "Saturday", enabled: false, startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "Sunday", enabled: false, startTime: "09:00", endTime: "17:00" }
  ]
};

describe("mentor booking slots", () => {
  it("builds only 1-hour starts inside a window", () => {
    expect(buildOneHourSlotsForWindow({ startTime: "09:00", endTime: "12:00" })).toEqual([
      "09:00",
      "10:00",
      "11:00"
    ]);
  });

  it("marks overlapping meetings as taken", () => {
    // Find a Monday in the near future relative to a fixed "now"
    const monday = "2030-01-07"; // known Monday
    const startIso = zonedDateTimeToUtc(monday, "10:00", "ET").toISOString();
    const endIso = zonedDateTimeToUtc(monday, "11:00", "ET").toISOString();
    const slots = buildSlotsForDate({
      isoDate: monday,
      schedule,
      now: new Date("2030-01-01T12:00:00.000Z"),
      meetings: [{ id: "m1", status: "pending", startTime: startIso, endTime: endIso }]
    });
    const ten = slots.find((slot) => slot.startTime === "10:00");
    const nine = slots.find((slot) => slot.startTime === "09:00");
    expect(ten.available).toBe(false);
    expect(ten.taken).toBe(true);
    expect(nine.available).toBe(true);
  });

  it("rejects bookings that are not exactly one hour", () => {
    const monday = "2030-01-07";
    const result = validateMentorBookingSlot({
      startTime: zonedDateTimeToUtc(monday, "09:00", "ET").toISOString(),
      endTime: zonedDateTimeToUtc(monday, "10:30", "ET").toISOString(),
      schedule,
      now: new Date("2030-01-01T12:00:00.000Z")
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_duration");
  });

  it("rejects taken slots", () => {
    const monday = "2030-01-07";
    const startIso = zonedDateTimeToUtc(monday, "09:00", "ET").toISOString();
    const endIso = zonedDateTimeToUtc(monday, "10:00", "ET").toISOString();
    const result = validateMentorBookingSlot({
      startTime: startIso,
      endTime: endIso,
      schedule,
      now: new Date("2030-01-01T12:00:00.000Z"),
      meetings: [{ id: "m1", status: "scheduled", startTime: startIso, endTime: endIso }]
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("slot_taken");
  });

  it("lists upcoming bookable dates with open slots", () => {
    const dates = listBookableDates({
      schedule,
      now: new Date("2030-01-06T15:00:00.000Z"), // Monday evening ET-ish
      windowDays: 7
    });
    expect(dates.some((day) => day.weekday === "Tuesday")).toBe(true);
    expect(dates.every((day) => day.slots.length > 0)).toBe(true);
  });
});
