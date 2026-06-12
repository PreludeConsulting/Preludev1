import { useEffect } from "react";
import { rescheduleStoredReminders } from "../lib/calendarReminders.js";
import { useDashboardData } from "../context/DashboardDataContext.jsx";

/**
 * Restores in-session reminder timers after navigation.
 * TODO: Move to service worker registration when push notifications are added.
 */
export default function CalendarReminderBootstrap() {
  const { addNotification } = useDashboardData();

  useEffect(() => {
    rescheduleStoredReminders((payload) => {
      addNotification({
        title: payload.isTask ? `Upcoming task: ${payload.title}` : `Upcoming event: ${payload.title}`,
        body: payload.body,
        kind: "reminder"
      });
    });
  }, [addNotification]);

  return null;
}
