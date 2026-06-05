import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isDemoEmail } from "../../data/demoAccounts.js";
import { getDemoDashboardForUser } from "../../data/demoDashboardData.js";
import {
  connectGoogleCalendar,
  connectZoom,
  disconnectGoogleCalendar,
  disconnectZoom,
  getDashboardAppData,
  getMeetings,
  createMeeting as apiCreateMeeting
} from "../../lib/dashboardApi.js";
import { PLACEHOLDER_EVENTS, PLACEHOLDER_MESSAGES, PLACEHOLDER_MENTOR, PLACEHOLDER_STUDENTS, PLACEHOLDER_TASKS } from "../data/placeholders.js";

const DashboardDataContext = createContext(null);

export function DashboardDataProvider({ children, user }) {
  const [integrations, setIntegrations] = useState({
    googleCalendar: { connected: false },
    zoom: { connected: false }
  });
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [apiDemo, setApiDemo] = useState(null);
  const [loading, setLoading] = useState(true);

  const localDemo = useMemo(
    () => (user?.email && isDemoEmail(user.email) ? getDemoDashboardForUser(user.email, user.role) : null),
    [user?.email, user?.role]
  );

  const demo = apiDemo || localDemo;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDashboardAppData();
      setIntegrations(data.integrations || integrations);
      setMeetings(data.meetings || []);
      setNotifications(data.notifications || []);
      setApiDemo(data.demo || null);
    } catch {
      if (localDemo) {
        setMeetings(localDemo.meetings || []);
        setApiDemo(localDemo);
      } else {
        setMeetings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [localDemo]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const scheduleMeeting = useCallback(async (payload) => {
    const { meeting } = await apiCreateMeeting(payload);
    setMeetings((prev) => [...prev, meeting]);
    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        title: payload.status === "pending" ? "Meeting request sent" : "Zoom meeting scheduled",
        body: meeting.zoomJoinUrl ? `Join link: ${meeting.zoomJoinUrl}` : meeting.title,
        unread: true
      },
      ...prev
    ]);
    return meeting;
  }, []);

  const value = useMemo(
    () => ({
      loading,
      isDemo: Boolean(demo),
      demo,
      integrations,
      meetings: demo?.meetings?.length ? demo.meetings : meetings,
      notifications,
      events: demo?.events ?? PLACEHOLDER_EVENTS,
      tasks: demo?.tasks ?? PLACEHOLDER_TASKS,
      mentor: demo?.mentor ?? PLACEHOLDER_MENTOR,
      students: demo?.students ?? PLACEHOLDER_STUDENTS,
      messages: demo?.messages ?? PLACEHOLDER_MESSAGES,
      conversations: demo?.conversations ?? [],
      gamification: demo?.gamification ?? null,
      studentActivityFeed: demo?.studentActivityFeed ?? [],
      essays: demo?.essays ?? [],
      extracurriculars: demo?.extracurriculars ?? [],
      aiSuggestions: demo?.aiSuggestions ?? [],
      profile: demo?.profile ?? null,
      summaryCards: demo?.summaryCards ?? null,
      deadlines: demo?.deadlines ?? [],
      applicationProgress: demo?.applicationProgress ?? null,
      pendingRequests: demo?.pendingRequests ?? [],
      availability: demo?.availability ?? [],
      privateNotes: demo?.privateNotes ?? {},
      refresh,
      scheduleMeeting,
      connectGoogle: async () => {
        const r = await connectGoogleCalendar();
        setIntegrations(r.integrations);
      },
      disconnectGoogle: async () => {
        const r = await disconnectGoogleCalendar();
        setIntegrations(r.integrations);
      },
      connectZoomAccount: async () => {
        const r = await connectZoom();
        setIntegrations(r.integrations);
      },
      disconnectZoomAccount: async () => {
        const r = await disconnectZoom();
        setIntegrations(r.integrations);
      },
      reloadMeetings: async () => {
        const { meetings: next } = await getMeetings();
        setMeetings(next);
      }
    }),
    [loading, demo, integrations, meetings, notifications, refresh, scheduleMeeting]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData requires DashboardDataProvider");
  return ctx;
}
