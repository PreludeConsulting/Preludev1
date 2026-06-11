import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  connectGoogleCalendar,
  connectZoom,
  disconnectGoogleCalendar,
  disconnectZoom,
  getDashboardAppData,
  getMeetings,
  createMeeting as apiCreateMeeting
} from "../../lib/dashboardApi.js";
import { isSupabaseConfigured } from "../../lib/supabaseConfig.js";
import {
  createCalendarEvent,
  createNotification,
  loadSupabaseDashboard,
  markNotificationsRead,
  saveResource,
  sendMessage,
  updateSupabaseOnboarding,
  updateSupabasePreferences,
  updateSupabaseProfile
} from "../../lib/supabaseData.js";
import { PLACEHOLDER_EVENTS, PLACEHOLDER_MESSAGES, PLACEHOLDER_MENTOR, PLACEHOLDER_STUDENTS, PLACEHOLDER_TASKS } from "../data/placeholders.js";

const DashboardDataContext = createContext(null);

const EMPTY_ONBOARDING = {
  profileComplete: 0,
  mentorMatchingStarted: false,
  mentorMatchingComplete: false,
  questionnaireAnswers: {}
};

export function DashboardDataProvider({ children, user }) {
  const useSupabase = isSupabaseConfigured() && user?.authProvider === "supabase";
  const [integrations, setIntegrations] = useState({
    googleCalendar: { connected: false },
    zoom: { connected: false }
  });
  const [meetings, setMeetings] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [mentor, setMentor] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [onboarding, setOnboarding] = useState(EMPTY_ONBOARDING);
  const [savedResources, setSavedResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (useSupabase) {
      try {
        const data = await loadSupabaseDashboard(user.id, user.email);
        if (data.errors?.length) {
          setError("Some dashboard data could not be loaded. Try refreshing.");
        }
        setProfile(data.profile);
        setPreferences(data.preferences);
        setOnboarding(data.onboarding || EMPTY_ONBOARDING);
        setMentor(data.mentor);
        setMentors(data.mentors || []);
        setMeetings(data.meetings || []);
        setEvents(data.events || []);
        setMessages(data.messages || []);
        setConversations(data.conversations || []);
        setNotifications(data.notifications || []);
        setSavedResources(data.savedResources || []);
      } catch (err) {
        setError(err.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const data = await getDashboardAppData();
      setIntegrations(data.integrations || integrations);
      setMeetings(data.meetings || []);
      setNotifications(data.notifications || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [user, useSupabase]);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setMeetings([]);
      setEvents([]);
      setNotifications([]);
      setMessages([]);
      setConversations([]);
      setMentor(null);
      setMentors([]);
      setProfile(null);
      setPreferences(null);
      setOnboarding(EMPTY_ONBOARDING);
      setSavedResources([]);
      setLoading(false);
    }
  }, [user?.id, refresh]);

  const scheduleMeeting = useCallback(
    async (payload) => {
      if (useSupabase && user) {
        const start = payload.startTime || payload.start || new Date().toISOString();
        const { event, error: err } = await createCalendarEvent(user.id, {
          title: payload.title || "Mentor session",
          description: payload.notes,
          startTime: start,
          endTime: payload.endTime,
          eventType: "meeting",
          meetingUrl: payload.zoomJoinUrl,
          status: payload.status || "pending"
        });
        if (err) throw new Error(err);
        setMeetings((prev) => [...prev, event]);
        const notif = await createNotification(user.id, {
          title: payload.status === "pending" ? "Meeting request sent" : "Session scheduled",
          body: event.title,
          link: "/dashboard/student/calendar"
        });
        if (notif.notification) {
          setNotifications((prev) => [notif.notification, ...prev]);
        }
        return event;
      }

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
    },
    [useSupabase, user]
  );

  const saveProfile = useCallback(
    async (fields) => {
      if (!useSupabase || !user) return null;
      const { profile: next, error: err } = await updateSupabaseProfile(user.id, fields);
      if (err) throw new Error(err);
      setProfile((p) => ({ ...p, ...fields }));
      return next;
    },
    [useSupabase, user]
  );

  const savePreferences = useCallback(
    async (prefs) => {
      if (!useSupabase || !user) return null;
      const { error: err } = await updateSupabasePreferences(user.id, prefs);
      if (err) throw new Error(err);
      setPreferences(prefs);
      return prefs;
    },
    [useSupabase, user]
  );

  const saveOnboarding = useCallback(
    async (fields) => {
      if (!useSupabase || !user) return null;
      const { error: err } = await updateSupabaseOnboarding(user.id, fields);
      if (err) throw new Error(err);
      setOnboarding((prev) => ({ ...prev, ...fields }));
      return fields;
    },
    [useSupabase, user]
  );

  const postMessage = useCallback(
    async (body) => {
      if (!useSupabase || !user) return null;
      const { message, error: err } = await sendMessage(user.id, {
        body,
        senderName: user.name,
        senderRole: "student"
      });
      if (err) throw new Error(err);
      setMessages((prev) => [message, ...prev]);
      return message;
    },
    [useSupabase, user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (useSupabase && user) {
      await markNotificationsRead(user.id);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, [useSupabase, user]);

  const saveUserResource = useCallback(
    async (resource) => {
      if (!useSupabase || !user) return null;
      const { resource: saved, error: err } = await saveResource(user.id, resource);
      if (err) throw new Error(err);
      setSavedResources((prev) => [saved, ...prev]);
      return saved;
    },
    [useSupabase, user]
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      isDemo: false,
      useSupabaseData: useSupabase,
      integrations,
      meetings,
      notifications,
      events: useSupabase ? events : PLACEHOLDER_EVENTS,
      tasks: useSupabase ? [] : PLACEHOLDER_TASKS,
      mentor: useSupabase ? mentor : PLACEHOLDER_MENTOR,
      mentors,
      students: PLACEHOLDER_STUDENTS,
      messages: useSupabase ? messages : PLACEHOLDER_MESSAGES,
      conversations,
      gamification: null,
      studentActivityFeed: [],
      essays: [],
      extracurriculars: [],
      aiSuggestions: [],
      profile,
      preferences: preferences,
      onboarding,
      savedResources: savedResources,
      summaryCards: null,
      deadlines: [],
      applicationProgress: onboarding?.profileComplete
        ? {
            collegeList: onboarding.profileComplete,
            essays: Math.max(0, onboarding.profileComplete - 10),
            extracurriculars: Math.max(0, onboarding.profileComplete - 20),
            scholarships: Math.max(0, onboarding.profileComplete - 30),
            profile: onboarding.profileComplete
          }
        : null,
      pendingRequests: [],
      availability: [],
      privateNotes: {},
      refresh,
      scheduleMeeting,
      saveProfile,
      savePreferences,
      saveOnboarding,
      postMessage,
      markAllNotificationsRead,
      saveUserResource,
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
        if (useSupabase && user) {
          const data = await loadSupabaseDashboard(user.id, user.email);
          setMeetings(data.meetings || []);
          return;
        }
        const { meetings: next } = await getMeetings();
        setMeetings(next);
      }
    }),
    [
      loading,
      error,
      useSupabase,
      integrations,
      meetings,
      notifications,
      events,
      mentor,
      mentors,
      messages,
      conversations,
      profile,
      preferences,
      onboarding,
      savedResources,
      refresh,
      scheduleMeeting,
      saveProfile,
      savePreferences,
      saveOnboarding,
      postMessage,
      markAllNotificationsRead,
      saveUserResource,
      user
    ]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData requires DashboardDataProvider");
  return ctx;
}
