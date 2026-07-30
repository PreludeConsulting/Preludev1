import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAvailableMentorSlots } from "../../lib/dashboardApi.js";
import { listBookableDates } from "../../../shared/mentorBookingSlots.js";

const POLL_INTERVAL_MS = 30_000;

function readPersistedMentorSchedule(mentorUserId) {
  try {
    const keys = [mentorUserId, "demo-mentor-maya"].filter(Boolean);
    for (const key of keys) {
      const fromMemory = globalThis.__preludeMentorSchedules?.[key];
      if (fromMemory) return fromMemory;
    }
    if (typeof window === "undefined") return null;
    for (const key of keys) {
      const raw = window.localStorage.getItem(`prelude_mentor_availability_schedule_${key}`);
      if (!raw) continue;
      return JSON.parse(raw);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load mentor bookable slots for student request UI.
 * Prefers API (live taken slots + latest availability); falls back to local schedule + known meetings.
 * Refreshes on focus/visibility and polls while the booking surface is open so mentor updates appear.
 */
export function useMentorBookingSlots({
  mentorUserId = null,
  schedule = null,
  meetings = [],
  enabled = true,
  pollIntervalMs = POLL_INTERVAL_MS
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
  const scheduleKey = useMemo(() => {
    if (!schedule) return "";
    try {
      return JSON.stringify(schedule);
    } catch {
      return String(schedule?.timezone || "");
    }
  }, [schedule]);

  const meetingsRef = useRef(meetings);
  const scheduleRef = useRef(schedule);
  const requestIdRef = useRef(0);

  useEffect(() => {
    meetingsRef.current = meetings;
  }, [meetingKey, meetings]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [scheduleKey, schedule]);

  const applyLocalSchedule = useCallback((localSchedule, requestId) => {
    if (!localSchedule) return false;
    if (requestId !== requestIdRef.current) return true;
    const localDates = listBookableDates({
      schedule: localSchedule,
      meetings: meetingsRef.current
    });
    setTimezone(localSchedule.timezone || "ET");
    setDates(localDates);
    setError("");
    return true;
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) {
        setDates([]);
        setError("");
        return;
      }

      const requestId = ++requestIdRef.current;
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const resolveFallbackSchedule = () =>
        scheduleRef.current || readPersistedMentorSchedule(mentorUserId);

      try {
        if (mentorUserId) {
          const payload = await getAvailableMentorSlots(mentorUserId);
          if (requestId !== requestIdRef.current) return;
          const hasOpenDays = (payload.schedule?.days || []).some((day) => day.enabled);
          if (hasOpenDays || (payload.dates || []).length) {
            setTimezone(payload.timezone || payload.schedule?.timezone || "ET");
            setDates(payload.dates || []);
            setError("");
            return;
          }
          if (applyLocalSchedule(resolveFallbackSchedule(), requestId)) return;
          setDates([]);
          setError("");
          return;
        }

        if (applyLocalSchedule(resolveFallbackSchedule(), requestId)) return;

        if (requestId !== requestIdRef.current) return;
        setDates([]);
        setError("Mentor availability is not available yet.");
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (applyLocalSchedule(resolveFallbackSchedule(), requestId)) return;
        setDates([]);
        setError(err?.message || "Could not load mentor availability.");
      } finally {
        if (!silent && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [enabled, mentorUserId, scheduleKey, meetingKey, applyLocalSchedule]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refresh({ silent: true });
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    const interval =
      pollIntervalMs > 0
        ? window.setInterval(() => {
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
            refresh({ silent: true });
          }, pollIntervalMs)
        : null;

    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      if (interval) window.clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, refresh]);

  return {
    dates,
    loading,
    error,
    timezone,
    refresh
  };
}
