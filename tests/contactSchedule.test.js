import { describe, expect, it } from "vitest";
import {
  BOOKING_WINDOW_DAYS,
  CALL_WINDOWS,
  CONTACT_EMAIL,
  buildAvailableCallSlots,
  buildCallWindowSlots,
  buildContactSchedule,
  buildContactEmailBody,
  buildContactEmailSubject,
  buildGmailComposeUrl,
  buildMailtoHref,
  buildScheduleMonths,
  formatDateLabel,
  formatTimeLabel,
  getAvailableTimes,
  getCalendarCells
} from "../src/lib/contactSchedule.js";

describe("contact scheduling helpers", () => {
  it("builds separate 30-minute call starts inside each call window", () => {
    expect(buildCallWindowSlots(CALL_WINDOWS.weekday)).toEqual([
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30"
    ]);
    expect(buildCallWindowSlots(CALL_WINDOWS.saturday)).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30"
    ]);
  });

  it("generates availability for weekdays and Saturdays, but not Sundays", () => {
    const now = new Date("2026-07-02T13:00:00Z");
    const slots = buildAvailableCallSlots({
      now,
      months: [{ year: 2026, monthIndex: 6 }]
    });

    expect(slots["2026-07-02"]).toEqual(buildCallWindowSlots(CALL_WINDOWS.weekday));
    expect(slots["2026-07-04"]).toEqual(buildCallWindowSlots(CALL_WINDOWS.saturday));
    expect(slots["2026-07-05"]).toBeUndefined();
  });

  it("limits availability to a rolling week-and-a-half booking window", () => {
    const now = new Date("2026-07-02T13:00:00Z");
    const slots = buildAvailableCallSlots({
      now,
      months: [{ year: 2026, monthIndex: 6 }]
    });

    expect(BOOKING_WINDOW_DAYS).toBe(11);
    expect(slots["2026-07-01"]).toBeUndefined();
    expect(slots["2026-07-02"]).toBeDefined();
    expect(slots["2026-07-11"]).toEqual(buildCallWindowSlots(CALL_WINDOWS.saturday));
    expect(slots["2026-07-13"]).toBeUndefined();
  });

  it("moves the schedule month range as the rolling booking window moves", () => {
    const months = buildScheduleMonths(new Date("2026-07-30T13:00:00Z"));

    expect(months).toEqual([
      { year: 2026, monthIndex: 6 },
      { year: 2026, monthIndex: 7 }
    ]);
  });

  it("removes same-day call starts that have already passed", () => {
    const now = new Date("2026-07-02T18:45:00Z");
    const schedule = buildContactSchedule(now);

    expect(schedule.availableCallSlots["2026-07-02"]).toEqual(["15:00", "15:30"]);
    expect(schedule.firstAvailableDate).toBe("2026-07-02");
    expect(schedule.firstAvailableTime).toBe("15:00");
  });

  it("marks only configured calendar dates as available", () => {
    const cells = getCalendarCells(2026, 6, {
      "2026-07-06": ["10:00"],
      "2026-07-20": ["13:30"]
    });

    expect(cells).toHaveLength(35);
    expect(cells.find((cell) => cell.isoDate === "2026-07-06")).toMatchObject({
      day: 6,
      available: true
    });
    expect(cells.find((cell) => cell.isoDate === "2026-07-07")).toMatchObject({
      day: 7,
      available: false
    });
  });

  it("formats selected dates and times for people", () => {
    expect(formatDateLabel("2026-07-06")).toBe("Monday, July 6, 2026");
    expect(formatTimeLabel("09:00")).toBe("9:00 AM");
    expect(formatTimeLabel("15:30")).toBe("3:30 PM");
  });

  it("returns the available slots for a selected date", () => {
    const now = new Date("2026-07-02T13:00:00Z");
    const slots = buildAvailableCallSlots({ now });

    expect(getAvailableTimes("2026-07-06", slots)).toEqual(buildCallWindowSlots(CALL_WINDOWS.weekday));
    expect(getAvailableTimes("2026-07-04", slots)).toEqual(buildCallWindowSlots(CALL_WINDOWS.saturday));
    expect(getAvailableTimes("2026-07-05", slots)).toEqual([]);
  });

  it("builds a booking email with the selected call details", () => {
    const options = {
      selectedDate: "2026-07-06",
      selectedTime: "10:00",
      name: "Jordan Lee",
      email: "jordan@example.com",
      studentYear: "11th grade",
      topic: "Essay strategy and school list"
    };

    expect(buildContactEmailSubject(options)).toBe(
      "Prelude discovery call request - Monday, July 6, 2026 at 10:00 AM"
    );
    expect(buildContactEmailBody(options)).toContain(
      "I would like to request the 30-minute discovery call on Monday, July 6, 2026 at 10:00 AM"
    );
    expect(buildContactEmailBody(options)).toContain("Essay strategy and school list");
  });

  it("builds mailto and Gmail compose URLs without losing recipient or body", () => {
    const options = {
      selectedDate: "2026-07-06",
      selectedTime: "10:00",
      name: "Jordan Lee",
      email: "jordan@example.com",
      studentYear: "11th grade",
      topic: "Need help choosing target schools"
    };
    const mailto = buildMailtoHref(options);
    const gmail = buildGmailComposeUrl(options);

    expect(mailto.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true);
    expect(decodeURIComponent(mailto)).toContain("Need help choosing target schools");
    expect(gmail.startsWith("https://mail.google.com/mail/?")).toBe(true);

    const gmailParams = new URL(gmail).searchParams;
    expect(gmailParams.get("to")).toBe(CONTACT_EMAIL);
    expect(gmailParams.get("su")).toContain("Prelude discovery call request");
    expect(gmailParams.get("body")).toContain("Jordan Lee");
  });
});
