import { useCallback, useEffect, useMemo, useState } from "react";
import { getAvailableMentorSlots } from "../../lib/dashboardApi.js";
import { listBookableDates } from "../../../shared/mentorBookingSlots.js";

/**
 * Load mentor bookable slots for student request UI.
 * Prefers API (live taken slots); falls back to local schedule + known meetings.
 */
export function useMentorBookingSlots({
  mentorUserId = null,
  schedule = null,
  meetings = [],
  enabled = true
} = {}) {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState("ET");

  const meetingKey = useMemo(
    () =>
      (meetings || [])
        .map((m) => `${m.id}:${m.startTime || m.start}:${m.status}`)
        .join("|"),
    [meetings]
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setDates([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (mentorUserId) {
        const payload = await getAvailableMentorSlots(mentorUserId);
        setTimezone(payload.timezone || payload.schedule?.timezone || "ET");
        setDates(payload.dates || []);
        return;
      }

      if (schedule) {
        const localDates = listBookableDates({ schedule, meetings });
        setTimezone(schedule.timezone || "ET");
        setDates(localDates);
        return;
      }

      setDates([]);
      setError("Mentor availability is not available yet.");
    } catch (err) {
      if (schedule) {
        const localDates = listBookableDates({ schedule, meetings });
        setTimezone(schedule.timezone || "ET");
        setDates(localDates);
        setError("");
      } else {
        setDates([]);
        setError(err?.message || "Could not load mentor availability.");
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, mentorUserId, schedule, meetingKey, meetings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    dates,
    loading,
    error,
    timezone,
    refresh
  };
}
