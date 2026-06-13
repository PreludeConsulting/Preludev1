import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { updateProfile } from "../../lib/auth.js";
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
  deleteCalendarEvent,
  loadSupabaseDashboard,
  markNotificationsRead as markSupabaseNotificationsRead,
  saveResource,
  sendMessage,
  updateCalendarEvent,
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
import { INITIAL_SAVED_COLLEGES } from "../data/collegeExploreData.js";
import { PLACEHOLDER_ESSAYS, PLACEHOLDER_EVENTS, PLACEHOLDER_MESSAGES, PLACEHOLDER_MENTOR, PLACEHOLDER_STUDENTS, PLACEHOLDER_TASKS } from "../data/placeholders.js";
import {
  cancelCalendarReminder,
  isReminderEnabled,
  scheduleCalendarReminder
} from "../lib/calendarReminders.js";
import {
  loadLocalDashboardStore,
  patchLocalDashboardStore,
  saveLocalDashboardStore
} from "../lib/localDashboardStore.js";

const DashboardDataContext = createContext(null);

function hasProfileData(profile) {
  return Boolean(profile?.grade || profile?.graduationYear || profile?.gpa != null);
}

function normalizeProfileShape(profile) {
  if (!profile) return profile;
  return {
    ...profile,
    majors: profile.majors || profile.targetMajors || [],
    colleges: profile.colleges || profile.collegeInterests || []
  };
}

function calendarItemToSupabase(item) {
  const isTask = item.formVariant === "task" || item.calendarItemType === "task";
  return {
    title: item.title,
    description: item.description,
    startTime: item.start,
    endTime: item.end,
    eventType: isTask ? "personal" : "session"
  };
}

function buildMentorConversation(mentor, messageList, userName) {
  if (!messageList.length) return [];
  const participant = {
    id: mentor?.id || "mentor",
    name: mentor?.name || "Mentor",
    role: "Mentor",
    context: mentor?.major ? `${mentor.university || "University"} · ${mentor.major}` : "Your mentor",
    status: "Active recently",
    online: true
  };
  const messages = [...messageList]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((m) => ({
      id: m.id,
      sender: m.senderRole === "student" || m.sender === "me" ? "me" : "them",
      body: m.body,
      text: m.body,
      createdAt: m.createdAt,
      status: m.status || "delivered"
    }));

  return [{
    id: "mentor",
    participant,
    lastActivity: messages[messages.length - 1]?.createdAt || new Date().toISOString(),
    unread: 0,
    messages
  }];
}

function computeProfileCompletion(profile) {
  const checks = [
    profile?.grade,
    profile?.graduationYear,
    profile?.gpa,
    profile?.sat,
    profile?.majors?.length || profile?.targetMajors?.length,
    profile?.colleges?.length || profile?.collegeInterests?.length
  ];
  const filled = checks.filter((v) => v != null && v !== "" && v !== 0).length;
  return Math.round((filled / checks.length) * 100);
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
  const [userCalendarEvents, setUserCalendarEvents] = useState([]);
  const [localTasks, setLocalTasks] = useState(null);
  const [localEssays, setLocalEssays] = useState(null);
  const [savedColleges, setSavedColleges] = useState(null);
  const [localConversationMessages, setLocalConversationMessages] = useState([]);
  const [profileOverrides, setProfileOverrides] = useState({});
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
        setEvents((data.events || []).filter((e) => !e.userCreated));
        setUserCalendarEvents((data.events || []).filter((e) => e.userCreated));
        setMessages(data.messages || []);
        setConversations(
          data.conversations?.length && data.conversations[0]?.messages
            ? data.conversations
            : buildMentorConversation(data.mentor, data.messages || [], user.name)
        );
        setNotifications(data.notifications || []);
        setSavedResources(data.savedResources || []);
      } catch (err) {
        setError(err.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const store = loadLocalDashboardStore(user.id);
    setUserCalendarEvents(store.calendarEvents || []);
    setLocalTasks(store.tasks?.length ? store.tasks : null);
    setLocalEssays(store.essays?.length ? store.essays : null);
    setSavedColleges(store.savedColleges ?? null);
    setLocalConversationMessages(store.conversationMessages || []);
    setProfileOverrides(store.profileOverrides || {});

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
      setUserCalendarEvents([]);
      setLocalTasks(null);
      setLocalEssays(null);
      setSavedColleges(null);
      setLocalConversationMessages([]);
      setProfileOverrides({});
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
      if (!user) return null;

      if (useSupabase) {
        const { profile: next, error: err } = await updateSupabaseProfile(user.id, fields);
        if (err) throw new Error(err);
        setProfile((p) => normalizeProfileShape({ ...p, ...fields }));
        const completion = computeProfileCompletion({ ...fields });
        await updateSupabaseOnboarding(user.id, { profileComplete: completion });
        setOnboarding((prev) => ({ ...prev, profileComplete: completion }));
        return next;
      }

      try {
        await updateProfile(fields);
      } catch {
        /* demo / offline — local state still updates */
      }

      setProfile((p) => {
        const display = {
          grade: fields.gradeLevel ?? p?.grade,
          graduationYear: fields.graduationYear ?? p?.graduationYear,
          gpa: fields.gpa ?? p?.gpa,
          weightedGpa: fields.weightedGpa ?? p?.weightedGpa,
          sat: fields.sat ?? p?.sat,
          majors: fields.targetMajors ?? p?.majors ?? p?.targetMajors,
          colleges: fields.collegeInterests ?? p?.colleges ?? p?.collegeInterests
        };
        return normalizeProfileShape({ ...p, ...display });
      });
      const display = {
        grade: fields.gradeLevel ?? profile?.grade,
        graduationYear: fields.graduationYear ?? profile?.graduationYear,
        gpa: fields.gpa ?? profile?.gpa,
        weightedGpa: fields.weightedGpa ?? profile?.weightedGpa,
        sat: fields.sat ?? profile?.sat,
        majors: fields.targetMajors ?? profile?.majors ?? profile?.targetMajors,
        colleges: fields.collegeInterests ?? profile?.colleges ?? profile?.collegeInterests
      };
      setProfileOverrides((prev) => {
        const next = { ...prev, ...display };
        patchLocalDashboardStore(user.id, { profileOverrides: next });
        return next;
      });
      return display;
    },
    [useSupabase, user]
  );

  const savePreferences = useCallback(
    async (prefs) => {
      if (!user) return null;
      if (useSupabase) {
        const { error: err } = await updateSupabasePreferences(user.id, prefs);
        if (err) throw new Error(err);
      }
      setPreferences(prefs);
      return prefs;
    },
    [useSupabase, user]
  );

  const saveOnboarding = useCallback(
    async (fields) => {
      if (!user) return null;
      if (useSupabase) {
        const { error: err } = await updateSupabaseOnboarding(user.id, fields);
        if (err) throw new Error(err);
      }
      setOnboarding((prev) => ({ ...prev, ...fields }));
      return fields;
    },
    [useSupabase, user]
  );

  const postMessage = useCallback(
    async (body, threadId = "mentor") => {
      if (!user || !body?.trim()) return null;
      const trimmed = body.trim();

      if (useSupabase) {
        const { message, error: err } = await sendMessage(user.id, {
          body: trimmed,
          senderName: user.name,
          senderRole: "student",
          threadId
        });
        if (err) throw new Error(err);
        setMessages((prev) => [message, ...prev]);
        setConversations((prev) => {
          const existing = prev[0];
          if (!existing) return buildMentorConversation(mentor, [message], user.name);
          const outgoing = {
            id: message.id,
            sender: "me",
            body: trimmed,
            text: trimmed,
            createdAt: message.createdAt,
            status: "sent"
          };
          return [{ ...existing, messages: [...existing.messages, outgoing], lastActivity: message.createdAt }];
        });
        return message;
      }

      const message = {
        id: `msg-${Date.now()}`,
        body: trimmed,
        senderRole: "student",
        senderName: user.name,
        createdAt: new Date().toISOString(),
        threadId
      };
      setLocalConversationMessages((prev) => {
        const next = [...prev, message];
        patchLocalDashboardStore(user.id, { conversationMessages: next });
        return next;
      });
      return message;
    },
    [mentor, useSupabase, user]
  );

  const persistCalendarItem = useCallback(
    async (item, existingId = null) => {
      if (!user) return item;

      if (useSupabase) {
        const payload = calendarItemToSupabase(item);
        if (existingId) {
          const { event, error: err } = await updateCalendarEvent(user.id, existingId, payload);
          if (err) throw new Error(err);
          const stored = { ...item, ...event, id: event.id, userCreated: true };
          setUserCalendarEvents((prev) => prev.map((e) => (e.id === existingId ? stored : e)));
          return stored;
        }
        const { event, error: err } = await createCalendarEvent(user.id, payload);
        if (err) throw new Error(err);
        const stored = { ...item, ...event, id: event.id, userCreated: true };
        setUserCalendarEvents((prev) => [...prev, stored]);
        return stored;
      }

      const id = existingId || item.id || `evt-${Date.now()}`;
      const stored = { ...item, id, userCreated: true };
      setUserCalendarEvents((prev) => {
        const next = existingId ? prev.map((e) => (e.id === existingId ? stored : e)) : [...prev, stored];
        const store = loadLocalDashboardStore(user.id);
        saveLocalDashboardStore(user.id, { ...store, calendarEvents: next });
        return next;
      });
      return stored;
    },
    [useSupabase, user]
  );

  const deleteCalendarItem = useCallback(
    async (eventId) => {
      if (!user || !eventId) return;

      if (useSupabase) {
        const { error: err } = await deleteCalendarEvent(user.id, eventId);
        if (err) throw new Error(err);
      } else {
        const store = loadLocalDashboardStore(user.id);
        const next = (store.calendarEvents || []).filter((e) => e.id !== eventId);
        saveLocalDashboardStore(user.id, { ...store, calendarEvents: next });
      }

      setUserCalendarEvents((prev) => prev.filter((e) => e.id !== eventId));
    },
    [useSupabase, user]
  );

  const addTask = useCallback(
    (title) => {
      if (!user || !title?.trim()) return null;
      const task = {
        id: `task-${Date.now()}`,
        title: title.trim(),
        done: false,
        priority: "medium"
      };
      setLocalTasks((prev) => {
        const base = prev || [];
        const next = [...base, task];
        patchLocalDashboardStore(user.id, { tasks: next });
        return next;
      });
      return task;
    },
    [user]
  );

  const toggleTask = useCallback(
    (taskId, done) => {
      if (!user) return;
      setLocalTasks((prev) => {
        const base = prev || [];
        const next = base.map((t) => (t.id === taskId ? { ...t, done } : t));
        patchLocalDashboardStore(user.id, { tasks: next });
        return next;
      });
    },
    [user]
  );

  const saveEssayDraft = useCallback(
    (essayId, { title, body }) => {
      if (!user) return null;
      const words = body ? body.trim().split(/\s+/).filter(Boolean).length : 0;
      const updatedAt = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
      setLocalEssays((prev) => {
        const base = prev?.length ? prev : PLACEHOLDER_ESSAYS;
        const next = base.map((e) =>
          e.id === essayId
            ? { ...e, title: title || e.title, body: body ?? e.body, words, updatedAt, status: words > 0 ? "In Progress" : e.status }
            : e
        );
        patchLocalDashboardStore(user.id, { essays: next });
        return next;
      });
    },
    [user]
  );

  const updateSavedColleges = useCallback(
    (colleges) => {
      if (!user) return;
      setSavedColleges(colleges);
      patchLocalDashboardStore(user.id, { savedColleges: colleges });
    },
    [user]
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
    const resolvedProfile = normalizeProfileShape(
      demo?.profile
        ?? (hasProfileData(profile) || Object.keys(profileOverrides).length
          ? { ...(hasProfileData(profile) ? profile : (isStudent ? DEFAULT_STUDENT_PROFILE : {})), ...profileOverrides }
          : (isStudent ? DEFAULT_STUDENT_PROFILE : profile))
    );
    const resolvedMentor = demo?.mentor ?? mentor ?? (isStudent ? PLACEHOLDER_MENTOR : null);
    const resolvedAcademicProgress = demo?.academicProgress ?? (isStudent ? DEFAULT_ACADEMIC_PROGRESS : null);
    const resolvedOpportunities = demo?.opportunities?.length
      ? demo.opportunities
      : (isStudent ? DEFAULT_OPPORTUNITIES : []);
    const resolvedStudentProfileStats = demo?.studentProfileStats ?? (isStudent ? DEFAULT_STUDENT_PROFILE_STATS : null);
    const resolvedTasks = demo?.tasks ?? localTasks ?? (useSupabase ? [] : PLACEHOLDER_TASKS);
    const resolvedEssays = demo?.essays?.length ? demo.essays : (localEssays?.length ? localEssays : []);
    const resolvedSavedColleges = savedColleges ?? INITIAL_SAVED_COLLEGES;
    const resolvedConversations = (() => {
      let base = demo?.conversations?.length
        ? demo.conversations
        : useSupabase
          ? conversations
          : conversations.length
            ? conversations
            : buildMentorConversation(resolvedMentor, localConversationMessages, user?.name);

      if (localConversationMessages.length && base.length) {
        const extra = localConversationMessages.map((m) => ({
          id: m.id,
          sender: "me",
          body: m.body,
          text: m.body,
          createdAt: m.createdAt,
          status: "sent"
        }));
        const thread = base[0];
        return [{
          ...thread,
          messages: [...thread.messages, ...extra],
          lastActivity: extra[extra.length - 1]?.createdAt || thread.lastActivity
        }];
      }

      return base;
    })();

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
      userCalendarEvents,
      persistCalendarItem,
      deleteCalendarItem,
      tasks: resolvedTasks,
      addTask,
      toggleTask,
      mentor: resolvedMentor,
      mentors,
      students: demo?.students ?? PLACEHOLDER_STUDENTS,
      messages: demo?.messages ?? (useSupabase ? messages : PLACEHOLDER_MESSAGES),
      conversations: resolvedConversations,
      gamification: demo?.gamification ?? null,
      studentActivityFeed: demo?.studentActivityFeed ?? [],
      essays: resolvedEssays,
      saveEssayDraft,
      savedColleges: resolvedSavedColleges,
      updateSavedColleges,
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
      userCalendarEvents,
      localTasks,
      localEssays,
      savedColleges,
      localConversationMessages,
      profileOverrides,
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
      persistCalendarItem,
      deleteCalendarItem,
      addTask,
      toggleTask,
      saveEssayDraft,
      updateSavedColleges,
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
