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
  markNotificationsRead as markSupabaseNotificationsRead,
  saveResource,
  sendMessage,
  updateSupabaseOnboarding,
  updateSupabasePreferences,
  updateSupabaseProfile
} from "../../lib/supabaseData.js";
import { isDemoEmail } from "../../data/demoAccounts.js";
import { getDemoDashboardForUser } from "../../data/demoDashboardData.js";
import { shouldUseDemoFixtures } from "../../lib/devAuthBypass.js";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import {
  DEFAULT_ACADEMIC_PROGRESS,
  DEFAULT_OPPORTUNITIES,
  DEFAULT_STUDENT_PROFILE,
  DEFAULT_STUDENT_PROFILE_STATS,
  buildDefaultStudentEvents
} from "../config/studentDashboardByGrade.js";
import { PLACEHOLDER_EVENTS, PLACEHOLDER_MESSAGES, PLACEHOLDER_MENTOR, PLACEHOLDER_STUDENTS, PLACEHOLDER_TASKS } from "../data/placeholders.js";
import {
  cancelCalendarReminder,
  isReminderEnabled,
  scheduleCalendarReminder
} from "../lib/calendarReminders.js";

const DashboardDataContext = createContext(null);

function hasProfileData(profile) {
  return Boolean(profile?.grade || profile?.graduationYear || profile?.gpa != null);
}

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
  const [pendingMeetingRequests, setPendingMeetingRequests] = useState([]);
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
  const [apiDemo, setApiDemo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const localDemo = useMemo(() => {
    if (!user) return null;
    if (user.email && isDemoEmail(user.email)) {
      return getDemoDashboardForUser(user.email, user.role);
    }
    if (shouldUseDemoFixtures(user)) {
      return getDemoDashboardForUser(user.email, user.role);
    }
    return null;
  }, [user]);

  const demo = localDemo || (!useSupabase ? apiDemo : null);

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
  }, [user, useSupabase, localDemo]);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setMeetings([]);
      setPendingMeetingRequests([]);
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
      setApiDemo(null);
      setLoading(false);
    }
  }, [user?.id, refresh]);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [
      {
        id: notification.id || `n-${Date.now()}`,
        title: notification.title,
        body: notification.body,
        unread: notification.unread ?? true,
        kind: notification.kind || "general",
        createdAt: notification.createdAt || new Date().toISOString()
      },
      ...prev
    ]);
  }, []);

  const markNotificationsRead = useCallback(async () => {
    if (useSupabase && user) {
      await markSupabaseNotificationsRead(user.id);
    }
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
  }, [useSupabase, user]);

  const scheduleEventReminder = useCallback((payload) => {
    if (!isReminderEnabled(payload.reminderMinutes)) {
      cancelCalendarReminder(payload.id);
      return null;
    }

    return scheduleCalendarReminder({
      ...payload,
      onTrigger: ({ title, body, isTask }) => {
        addNotification({
          title: isTask ? `Upcoming task: ${title}` : `Upcoming event: ${title}`,
          body,
          kind: "reminder"
        });
      }
    });
  }, [addNotification]);

  const cancelEventReminder = useCallback((id) => {
    cancelCalendarReminder(id);
  }, []);

  const scheduleMeeting = useCallback(
    async (payload) => {
      const isPending = payload.status === "pending";

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

        if (isPending) {
          setPendingMeetingRequests((prev) => [...prev, event]);
        } else {
          setMeetings((prev) => [...prev, event]);
        }

        const notif = await createNotification(user.id, {
          title: isPending ? "Meeting request sent" : "Session scheduled",
          body: event.title,
          link: "/dashboard/student/calendar"
        });
        if (notif.notification) {
          setNotifications((prev) => [notif.notification, ...prev]);
        }
        return event;
      }

      let meeting;
      try {
        ({ meeting } = await apiCreateMeeting(payload));
      } catch {
        meeting = {
          id: `mt-${Date.now()}`,
          ...payload,
          status: payload.status || "pending"
        };
      }

      if (isPending || meeting.status === "pending") {
        setPendingMeetingRequests((prev) => [...prev, meeting]);
        addNotification({
          title: "Meeting request sent",
          body: "Your mentor will review your request and confirm the meeting time.",
          unread: true
        });
        return meeting;
      }

      setMeetings((prev) => [...prev, meeting]);
      addNotification({
        title: "Meeting confirmed",
        body: meeting.zoomJoinUrl
          ? `${meeting.title} is scheduled. Join link: ${meeting.zoomJoinUrl}`
          : `${meeting.title} is scheduled.`,
        unread: true
      });
      return meeting;
    },
    [addNotification, useSupabase, user]
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

  const markAllNotificationsRead = markNotificationsRead;

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

  const value = useMemo(() => {
    const isStudent = roleFromUser(user) === "student";
    const resolvedEvents = demo?.events?.length
      ? demo.events
      : (events.length ? events : (isStudent ? buildDefaultStudentEvents() : PLACEHOLDER_EVENTS));
    const resolvedProfile = demo?.profile
      ?? (hasProfileData(profile) ? profile : (isStudent ? DEFAULT_STUDENT_PROFILE : profile));
    const resolvedMentor = demo?.mentor ?? mentor ?? (isStudent ? PLACEHOLDER_MENTOR : null);
    const resolvedAcademicProgress = demo?.academicProgress ?? (isStudent ? DEFAULT_ACADEMIC_PROGRESS : null);
    const resolvedOpportunities = demo?.opportunities?.length
      ? demo.opportunities
      : (isStudent ? DEFAULT_OPPORTUNITIES : []);
    const resolvedStudentProfileStats = demo?.studentProfileStats ?? (isStudent ? DEFAULT_STUDENT_PROFILE_STATS : null);

    return {
      loading,
      error,
      isDemo: Boolean(demo),
      demo,
      useSupabaseData: useSupabase,
      integrations,
      meetings: (demo?.meetings?.length ? demo.meetings : meetings).filter((m) => m.status !== "pending"),
      pendingMeetingRequests,
      notifications,
      addNotification,
      markNotificationsRead,
      scheduleEventReminder,
      cancelEventReminder,
      events: resolvedEvents,
      tasks: demo?.tasks ?? (useSupabase ? [] : PLACEHOLDER_TASKS),
      mentor: resolvedMentor,
      mentors,
      students: demo?.students ?? PLACEHOLDER_STUDENTS,
      messages: demo?.messages ?? (useSupabase ? messages : PLACEHOLDER_MESSAGES),
      conversations: demo?.conversations ?? (useSupabase ? conversations : []),
      gamification: demo?.gamification ?? null,
      studentActivityFeed: demo?.studentActivityFeed ?? [],
      essays: demo?.essays ?? [],
      extracurriculars: demo?.extracurriculars ?? [],
      aiSuggestions: demo?.aiSuggestions ?? [],
      profile: resolvedProfile,
      preferences,
      onboarding,
      savedResources,
      summaryCards: demo?.summaryCards ?? null,
      deadlines: demo?.deadlines ?? [],
      applicationProgress: demo?.applicationProgress
        ?? (useSupabase
          ? (onboarding?.profileComplete
            ? {
                collegeList: onboarding.profileComplete,
                essays: Math.max(0, onboarding.profileComplete - 10),
                extracurriculars: Math.max(0, onboarding.profileComplete - 20),
                scholarships: Math.max(0, onboarding.profileComplete - 30),
                profile: onboarding.profileComplete
              }
            : null)
          : null),
      academicProgress: resolvedAcademicProgress,
      studentProfileStats: resolvedStudentProfileStats,
      opportunities: resolvedOpportunities,
      collegeJourney: demo?.collegeJourney ?? [],
      essayTracker: demo?.essayTracker ?? [],
      financialAidTracker: demo?.financialAidTracker ?? [],
      pendingRequests: [
        ...pendingMeetingRequests.map((m) => ({
        id: m.id,
        studentName: m.studentName || "Student",
        studentId: m.studentId,
        requestedTime: new Date(m.startTime || m.start).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }),
        type: m.title || "Meeting request"
        })),
        ...(demo?.pendingRequests ?? [])
      ],
      availability: demo?.availability ?? [],
      privateNotes: demo?.privateNotes ?? {},
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
    };
  }, [
      loading,
      error,
      demo,
      useSupabase,
      integrations,
      meetings,
      pendingMeetingRequests,
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
      addNotification,
      markNotificationsRead,
      scheduleEventReminder,
      cancelEventReminder,
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
