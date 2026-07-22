// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { listBookableDates } = vi.hoisted(() => ({
  listBookableDates: vi.fn(() => Object.freeze([]))
}));

vi.mock("../shared/mentorBookingSlots.js", () => ({
  listBookableDates
}));

vi.mock("../src/lib/dashboardApi.js", () => ({
  getAvailableMentorSlots: vi.fn()
}));

import { useMentorBookingSlots } from "../src/dashboard/hooks/useMentorBookingSlots.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const schedule = Object.freeze({
  timezone: "America/New_York",
  weekly: {}
});

function Harness({ meetings }) {
  useMentorBookingSlots({ schedule, meetings, enabled: true });
  return null;
}

let root;
let host;

afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  root = null;
  host = null;
  listBookableDates.mockClear();
});

describe("useMentorBookingSlots", () => {
  it("does not refresh when a caller recreates equivalent meeting data", async () => {
    const meeting = Object.freeze({ id: "meeting-1", startTime: "2026-07-22T14:00:00Z", status: "scheduled" });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root.render(<Harness meetings={[meeting]} />);
    });
    expect(listBookableDates).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(<Harness meetings={[meeting]} />);
    });

    expect(listBookableDates).toHaveBeenCalledTimes(1);
  });
});
