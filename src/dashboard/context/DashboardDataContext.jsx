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
  formatDashboardPersistenceError,
  loadSupabaseDashboard,
  markNotificationsRead as markSupabaseNotificationsRead,
  saveResource,
  sendMessage,
  updateCalendarEvent,
  updateSupabaseOnboarding,
  updateSupabasePreferences,
  updateSupabaseProfile,
  mapProfile
} from "../../lib/supabaseData.js";
import {
  createTask,
  updateTask,
  saveEssayDraft as saveSupabaseEssayDraft,
  saveMyCollegeList
} from "../../lib/dashboardData.js";
import { isDemoEmail } from "../../data/demoAccounts.js";
import { getDemoDashboardForUser } from "../../data/demoDashboardData.js";
import { shouldUseDemoFixtures } from "../../lib/devAuthBypass.js";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import { EMPTY_STUDENT_PROFILE } from "../config/studentDashboardByGrade.js";
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
import {
  removeSharedEventFromStudent,
  resolveStudentUserId,
  syncSharedEventToStudent,
  findStudentCalendarEvent,
  upsertStudentCalendarEvent
} from "../lib/sharedCalendarEvents.js";
import { parseRequestedTime } from "../lib/mentorCalendarFeed.js";
import { getStudentDemoBundleBySlug } from "../lib/studentDemoBundle.js";
import { aggregateStudentCalendars } from "../lib/studentCalendarAggregate.js";
import { deriveAcademicProgress } from "../lib/studentProgressSync.js";
import {
  matchesAssignedStudentSync,
  matchesStudentSyncTarget,
  notifyStudentDashboardChanged,
  subscribeStudentDashboardChanged
} from "../lib/studentDashboardSync.js";
import { playLiveNotificationSound } from "../lib/notificationSounds.js";
import {
  enrichMentorStudentCalendarItem,
  enrichParentStudentCalendarItem,
  enrichStudentCalendarItem
} from "../lib/mentorStudentCalendar.js";

const DashboardDataContext = createContext(null);

function resolveStudentProfile(profile, profileOverrides, isStudent, demoProfile) {
  if (demoProfile) return normalizeProfileShape(demoProfile);
  const merged = normalizeProfileShape({ ...(profile || {}), ...profileOverrides });
  if (profile != null || Object.keys(profileOverrides).length > 0) {
    return merged;
  }
  return isStudent ? normalizeProfileShape(EMPTY_STUDENT_PROFILE) : null;
}

function profileFromSupabaseRow(row, email, fallbackProfile, fields) {
  if (row) return normalizeProfileShape(mapProfile(row, email));
  return buildProfileDisplayUpdate(fallbackProfile, fields);
}

function buildProfileDisplayUpdate(prev, fields) {
  const display = { ...(prev || {}) };

  if (fields.gradeLevel !== undefined) display.grade = fields.gradeLevel;
  if (fields.graduationYear !== undefined) display.graduationYear = fields.graduationYear;
  if (fields.gpa !== undefined) display.gpa = fields.gpa;
  if (fields.gpaScale !== undefined) display.gpaScale = fields.gpaScale;
  if (fields.weightedGpa !== undefined) display.weightedGpa = fields.weightedGpa;
  if (fields.sat !== undefined) display.sat = fields.sat;
  if (fields.act !== undefined) display.act = fields.act;
  if (fields.targetMajors !== undefined) display.majors = fields.targetMajors;
  if (fields.collegeInterests !== undefined) display.colleges = fields.collegeInterests;
  if (fields.extracurricularActivities !== undefined) display.extracurricularActivities = fields.extracurricularActivities;
  if (fields.awards !== undefined && Array.isArray(fields.awards)) display.awards = fields.awards;
  if (fields.leadership !== undefined && Array.isArray(fields.leadership)) display.leadership = fields.leadership;
  if (fields.volunteerExperience !== undefined && Array.isArray(fields.volunteerExperience)) {
    display.volunteerExperience = fields.volunteerExperience;
  }
  if (fields.workExperience !== undefined && Array.isArray(fields.workExperience)) display.workExperience = fields.workExperience;

  if (fields.mentorPreferences !== undefined) {
    const mp = fields.mentorPreferences;
    display.mentorPreferences = {
      ...(prev?.mentorPreferences || {}),
      ...mp
    };
    if (mp.location !== undefined) display.locationPreferences = mp.location;
    if (mp.size !== undefined) display.collegeSizePreferences = mp.size;
    if (mp.budget !== undefined) display.financialAidNotes = mp.budget;
    if (mp.activities !== undefined) display.activities = mp.activities;
    if (mp.leadershipRoles !== undefined) display.leadershipRoles = mp.leadershipRoles;
    if (mp.volunteerWork !== undefined) display.volunteerWork = mp.volunteerWork;
    if (mp.extracurricularEntries !== undefined) display.extracurricularActivities = mp.extracurricularEntries;
    if (mp.awardsEntries !== undefined) display.awards = mp.awardsEntries;
    if (mp.leadershipEntries !== undefined) display.leadership = mp.leadershipEntries;
    if (mp.volunteerEntries !== undefined) display.volunteerExperience = mp.volunteerEntries;
    if (mp.workEntries !== undefined) display.workExperience = mp.workEntries;
  }

  return normalizeProfileShape(display);
}

function normalizeProfileShape(profile) {
  if (!profile) return profile;
  const prefs = profile.mentorPreferences || {};
  return {
    ...profile,
    majors: profile.majors || profile.targetMajors || [],
    colleges: profile.colleges || profile.collegeInterests || [],
    extracurricularActivities: Array.isArray(profile.extracurricularActivities)
      ? profile.extracurricularActivities
      : (Array.isArray(prefs.extracurricularEntries) ? prefs.extracurricularEntries : []),
    awards: Array.isArray(profile.awards)
      ? profile.awards
      : (Array.isArray(prefs.awardsEntries) ? prefs.awardsEntries : []),
    leadership: Array.isArray(profile.leadership)
      ? profile.leadership
      : (Array.isArray(prefs.leadershipEntries) ? prefs.leadershipEntries : []),
    volunteerExperience: Array.isArray(profile.volunteerExperience)
      ? profile.volunteerExperience
      : (Array.isArray(prefs.volunteerEntries) ? prefs.volunteerEntries : []),
    workExperience: Array.isArray(profile.workExperience)
      ? profile.workExperience
      : (Array.isArray(prefs.workEntries) ? prefs.workEntries : [])
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

export function DashboardDataProvider({ children, user, overrides = null, mentorViewStudent = null, parentViewStudent = null }) {
  const useSupabase = isSupabaseConfigured() && user?.authProvider === "supabase";
  const [integrations, setIntegrations] = useState({
    googleCalendar: { connected: false },
    zoom: { connected: false }
  });
  const [meetings, setMeetings] = useState([]);
  const [pendingMeetingRequests, setPendingMeetingRequests] = useState([]);
  const [resolvedPendingRequestIds, setResolvedPendingRequestIds] = useState([]);
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
  const [supabaseTasks, setSupabaseTasks] = useState([]);
  const [supabaseEssays, setSupabaseEssays] = useState([]);
  const [supabaseDeadlines, setSupabaseDeadlines] = useState([]);
  const [supabaseSavedColleges, setSupabaseSavedColleges] = useState(null);
  const [savedColleges, setSavedColleges] = useState(null);
  const [localConversationMessages, setLocalConversationMessages] = useState([]);
  const [profileOverrides, setProfileOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studentSyncTick, setStudentSyncTick] = useState(0);

  const localDemo = useMemo(() => {
    if (!user) return null;
    const guardianSlug = mentorViewStudent?.id || parentViewStudent?.id;
    if (guardianSlug) {
      const guardianBundle = getStudentDemoBundleBySlug(guardianSlug);
      if (guardianBundle) return guardianBundle;
    }
    if (user.email && isDemoEmail(user.email)) {
      return getDemoDashboardForUser(user.email, user.role);
    }
    if (shouldUseDemoFixtures(user)) {
      return getDemoDashboardForUser(user.email, user.role);
    }
    return null;
  }, [user, mentorViewStudent?.id, parentViewStudent?.id]);

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
          setError(formatDashboardPersistenceError(data.errors));
        }
        const store = loadLocalDashboardStore(user.id);
        setProfileOverrides(store.profileOverrides || {});
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
        setSupabaseTasks(data.tasks || []);
        setSupabaseEssays(data.essays || []);
        setSupabaseDeadlines(data.deadlines || []);
        setSupabaseSavedColleges(data.savedColleges?.length ? data.savedColleges : null);
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
      setResolvedPendingRequestIds([]);
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
      setSupabaseTasks([]);
      setSupabaseEssays([]);
      setSupabaseDeadlines([]);
      setSupabaseSavedColleges(null);
      setSavedColleges(null);
      setLocalConversationMessages([]);
      setProfileOverrides({});
      setLoading(false);
    }
  }, [user?.id, refresh]);

  const reloadLocalCalendar = useCallback(() => {
    if (!user) return;
    const store = loadLocalDashboardStore(user.id);
    setUserCalendarEvents(store.calendarEvents || []);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    function handleStudentSync(event) {
      const assignedStudents = (localDemo || apiDemo)?.students ?? [];
      const matchesDirect = matchesStudentSyncTarget(event.detail, {
        userId: user.id,
        mentorViewStudent,
        parentViewStudent
      });
      const matchesMentorRoster = roleFromUser(user) === "mentor"
        && matchesAssignedStudentSync(event.detail, assignedStudents);

      if (!matchesDirect && !matchesMentorRoster) return;

      reloadLocalCalendar();
      setStudentSyncTick((tick) => tick + 1);
      if (useSupabase) {
        refresh();
      }
    }

    function handleStorage(event) {
      if (!event.key?.startsWith("prelude_dash_store_")) return;
      handleStudentSync({ detail: { studentId: user.id } });
    }

    const unsubscribe = subscribeStudentDashboardChanged(handleStudentSync);
    window.addEventListener("storage", handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, [user?.id, user?.role, mentorViewStudent, parentViewStudent, useSupabase, refresh, reloadLocalCalendar, localDemo, apiDemo]);

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
    if (!notification.silent) {
      playLiveNotificationSound();
    }
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

      const persistLocalProfile = (nextProfile) => {
        const normalized = normalizeProfileShape(nextProfile);
        setProfile(normalized);
        setProfileOverrides(normalized);
        patchLocalDashboardStore(user.id, { profileOverrides: normalized });
        return normalized;
      };

      if (useSupabase) {
        const { profile: row, error: profileErr } = await updateSupabaseProfile(user.id, fields);
        if (profileErr) throw new Error(profileErr);

        const display = persistLocalProfile(
          profileFromSupabaseRow(row, user.email, profile, fields)
        );

        const completion = computeProfileCompletion(display);
        const { error: onboardingErr } = await updateSupabaseOnboarding(user.id, { profileComplete: completion });
        if (onboardingErr) {
          setError(formatDashboardPersistenceError([onboardingErr]));
        } else {
          setOnboarding((prev) => ({ ...prev, profileComplete: completion }));
        }
        return display;
      }

      try {
        await updateProfile(fields);
      } catch {
        /* demo / offline — local state still updates */
      }

      const display = persistLocalProfile(buildProfileDisplayUpdate(profile, fields));
      return display;
    },
    [useSupabase, user, profile]
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

      let workingItem = item;
      if (mentorViewStudent) {
        workingItem = enrichMentorStudentCalendarItem(item, mentorViewStudent);
      } else if (parentViewStudent) {
        workingItem = enrichParentStudentCalendarItem(item, parentViewStudent);
      } else if (roleFromUser(user) === "student") {
        workingItem = enrichStudentCalendarItem(item);
      }

      const notifyCalendarSync = (studentSlug) => {
        if (studentSlug) {
          notifyStudentDashboardChanged(studentSlug);
          const studentUserId = resolveStudentUserId(studentSlug);
          if (studentUserId) notifyStudentDashboardChanged(studentUserId);
        }
        notifyStudentDashboardChanged(user.id);
        if (mentorViewStudent?.id) notifyStudentDashboardChanged(mentorViewStudent.id);
        if (parentViewStudent?.id) notifyStudentDashboardChanged(parentViewStudent.id);
      };

      const maybeSyncToStudent = async (stored) => {
        const studentSlug = stored.studentId;
        const studentUserId = studentSlug ? resolveStudentUserId(studentSlug) : null;
        const isMentorActor = roleFromUser(user) === "mentor" && !mentorViewStudent && !parentViewStudent;

        if (studentSlug && stored.shared !== false && isMentorActor) {
          syncSharedEventToStudent(studentSlug, {
            ...stored,
            createdByRole: stored.createdByRole || "mentor",
            sharedWithStudent: stored.sharedWithStudent ?? stored.shared !== false,
            itemType: stored.itemType || stored.calendarItemType || stored.formVariant || "event"
          });
          if (useSupabase && studentUserId && studentUserId !== user.id) {
            const payload = calendarItemToSupabase(stored);
            if (existingId) {
              await updateCalendarEvent(studentUserId, existingId, payload);
            } else {
              await createCalendarEvent(studentUserId, payload);
            }
          }
        } else if (studentSlug && isMentorActor && existingId) {
          upsertStudentCalendarEvent(studentSlug, stored);
        }

        notifyCalendarSync(studentSlug);
        return stored;
      };

      if (useSupabase) {
        const payload = calendarItemToSupabase(workingItem);
        if (existingId) {
          const { event, error: err } = await updateCalendarEvent(user.id, existingId, payload);
          if (err) throw new Error(err);
          const stored = { ...workingItem, ...event, id: event.id, userCreated: true };
          setUserCalendarEvents((prev) => {
            const inOwnStore = prev.some((entry) => entry.id === existingId);
            return inOwnStore ? prev.map((e) => (e.id === existingId ? stored : e)) : prev;
          });
          return maybeSyncToStudent(stored);
        }
        const { event, error: err } = await createCalendarEvent(user.id, payload);
        if (err) throw new Error(err);
        const stored = { ...workingItem, ...event, id: event.id, userCreated: true };
        setUserCalendarEvents((prev) => [...prev, stored]);
        return maybeSyncToStudent(stored);
      }

      const id = existingId || workingItem.id || `evt-${Date.now()}`;
      const stored = { ...workingItem, id, userCreated: true };
      setUserCalendarEvents((prev) => {
        const inOwnStore = !existingId || prev.some((entry) => entry.id === existingId);
        const next = existingId
          ? (inOwnStore ? prev.map((e) => (e.id === existingId ? stored : e)) : prev)
          : [...prev, stored];
        if (inOwnStore || !existingId) {
          const store = loadLocalDashboardStore(user.id);
          saveLocalDashboardStore(user.id, { ...store, calendarEvents: next });
        }
        return next;
      });

      if (stored.studentId && roleFromUser(user) === "student") {
        upsertStudentCalendarEvent(stored.studentId, stored);
      }

      return maybeSyncToStudent(stored);
    },
    [useSupabase, user, mentorViewStudent, parentViewStudent]
  );

  const deleteCalendarItem = useCallback(
    async (eventId) => {
      if (!user || !eventId) return;

      let existing = userCalendarEvents.find((item) => item.id === eventId);
      const assignedStudents = (localDemo || apiDemo)?.students ?? [];

      if (!existing && roleFromUser(user) === "mentor" && !mentorViewStudent && !parentViewStudent) {
        for (const student of assignedStudents) {
          const found = findStudentCalendarEvent(student.id, eventId);
          if (found) {
            existing = found;
            break;
          }
        }
      }

      const inOwnStore = userCalendarEvents.some((item) => item.id === eventId);

      if (useSupabase && inOwnStore) {
        const { error: err } = await deleteCalendarEvent(user.id, eventId);
        if (err) throw new Error(err);
      } else if (inOwnStore) {
        const store = loadLocalDashboardStore(user.id);
        const next = (store.calendarEvents || []).filter((e) => e.id !== eventId);
        saveLocalDashboardStore(user.id, { ...store, calendarEvents: next });
      }

      const studentSlug = existing?.studentId;
      if (studentSlug) {
        removeSharedEventFromStudent(studentSlug, eventId);
        const studentUserId = resolveStudentUserId(studentSlug);
        if (useSupabase && studentUserId) {
          await deleteCalendarEvent(studentUserId, eventId);
        }
        notifyStudentDashboardChanged(studentSlug);
        if (studentUserId) notifyStudentDashboardChanged(studentUserId);
      }

      notifyStudentDashboardChanged(user.id);
      if (mentorViewStudent?.id) notifyStudentDashboardChanged(mentorViewStudent.id);
      if (parentViewStudent?.id) notifyStudentDashboardChanged(parentViewStudent.id);

      setUserCalendarEvents((prev) => prev.filter((e) => e.id !== eventId));
    },
    [useSupabase, user, userCalendarEvents, mentorViewStudent, parentViewStudent, localDemo, apiDemo]
  );

  const declineMeetingRequest = useCallback((requestId) => {
    if (!requestId) return;
    setPendingMeetingRequests((prev) => prev.filter((item) => item.id !== requestId));
    setResolvedPendingRequestIds((prev) => (prev.includes(requestId) ? prev : [...prev, requestId]));
  }, []);

  const acceptMeetingRequest = useCallback(
    async (request) => {
      if (!request?.id) return null;

      const parsedStart = request.startTime
        ? new Date(request.startTime)
        : parseRequestedTime(request.requestedTime || request.start);
      const startTime = parsedStart && !Number.isNaN(parsedStart.getTime())
        ? parsedStart.toISOString()
        : new Date().toISOString();
      const endTime = request.endTime
        || new Date(new Date(startTime).getTime() + 45 * 60 * 1000).toISOString();

      const meeting = {
        id: `mt-${request.id}`,
        title: request.type || request.title || "Zoom check-in",
        studentId: request.studentId,
        studentName: request.studentName,
        startTime,
        endTime,
        meetingType: "zoom",
        zoomJoinUrl: request.zoomJoinUrl || "https://zoom.us/j/placeholder-approved",
        status: "scheduled",
        notes: request.notes
      };

      setPendingMeetingRequests((prev) => prev.filter((item) => item.id !== request.id));
      setResolvedPendingRequestIds((prev) => (prev.includes(request.id) ? prev : [...prev, request.id]));
      setMeetings((prev) => [...prev.filter((item) => item.id !== meeting.id), meeting]);

      await persistCalendarItem({
        id: `evt-${request.id}`,
        title: meeting.title,
        category: "mentor_meeting",
        start: startTime,
        end: endTime,
        studentId: meeting.studentId,
        studentName: meeting.studentName,
        shared: true,
        formVariant: "event",
        calendarItemType: "event",
        meetingType: "zoom",
        zoomJoinUrl: meeting.zoomJoinUrl,
        status: "scheduled",
        pillColor: "blue"
      });

      return meeting;
    },
    [persistCalendarItem]
  );

  const addTask = useCallback(
    async (title) => {
      if (!user || !title?.trim()) return null;
      const trimmed = title.trim();

      if (useSupabase) {
        const { task, error: err } = await createTask(user.id, { title: trimmed });
        if (err) throw new Error(err);
        setSupabaseTasks((prev) => [...prev, task]);
        return task;
      }

      const task = {
        id: `task-${Date.now()}`,
        title: trimmed,
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
    [useSupabase, user]
  );

  const toggleTask = useCallback(
    async (taskId, done) => {
      if (!user) return;

      if (useSupabase) {
        const { task, error: err } = await updateTask(user.id, taskId, { done });
        if (err) throw new Error(err);
        setSupabaseTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
        return;
      }

      setLocalTasks((prev) => {
        const base = prev || [];
        const next = base.map((t) => (t.id === taskId ? { ...t, done } : t));
        patchLocalDashboardStore(user.id, { tasks: next });
        return next;
      });
    },
    [useSupabase, user]
  );

  const saveEssayDraft = useCallback(
    async (essayId, { title, body }) => {
      if (!user) return null;

      if (useSupabase) {
        const isUuid = essayId && !String(essayId).startsWith("e-") && !String(essayId).startsWith("essay-");
        const { essay, error: err } = await saveSupabaseEssayDraft(
          user.id,
          isUuid ? essayId : null,
          { title, body }
        );
        if (err) throw new Error(err);
        setSupabaseEssays((prev) => {
          if (essayId && prev.some((e) => e.id === essayId)) {
            return prev.map((e) => (e.id === essayId ? essay : e));
          }
          if (prev.some((e) => e.id === essay.id)) {
            return prev.map((e) => (e.id === essay.id ? essay : e));
          }
          return [...prev, essay];
        });
        return essay;
      }

      const words = body ? body.trim().split(/\s+/).filter(Boolean).length : 0;
      const updatedAt = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
      setLocalEssays((prev) => {
        const base = prev?.length ? prev : [];
        if (!base.length && essayId) {
          return [{ id: essayId, title: title || "Untitled essay", body: body ?? "", words, updatedAt, status: words > 0 ? "In Progress" : "Not Started" }];
        }
        const next = base.map((e) =>
          e.id === essayId
            ? { ...e, title: title || e.title, body: body ?? e.body, words, updatedAt, status: words > 0 ? "In Progress" : e.status }
            : e
        );
        patchLocalDashboardStore(user.id, { essays: next });
        return next;
      });
    },
    [useSupabase, user]
  );

  const updateSavedColleges = useCallback(
    async (colleges) => {
      if (!user) return;
      if (useSupabase) {
        const { error: err } = await saveMyCollegeList(user.id, colleges);
        if (err) throw new Error(err);
        setSupabaseSavedColleges(colleges);
        return;
      }
      setSavedColleges(colleges);
      patchLocalDashboardStore(user.id, { savedColleges: colleges });
    },
    [useSupabase, user]
  );

  const effectivePersistCalendarItem = useCallback(
    async (item, existingId = null) => {
      const handler = overrides?.persistCalendarItem ?? persistCalendarItem;
      const result = await handler(item, existingId);
      reloadLocalCalendar();
      return result;
    },
    [overrides, persistCalendarItem, reloadLocalCalendar]
  );

  const effectiveDeleteCalendarItem = useCallback(
    async (eventId) => {
      const handler = overrides?.deleteCalendarItem ?? deleteCalendarItem;
      await handler(eventId);
      reloadLocalCalendar();
    },
    [overrides, deleteCalendarItem, reloadLocalCalendar]
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
    const isMentorStudentViewMode = Boolean(mentorViewStudent);
    const isParentStudentViewMode = Boolean(parentViewStudent);
    const isGuardianViewMode = isMentorStudentViewMode || isParentStudentViewMode;
    const isMentorAccount = roleFromUser(user) === "mentor" && !isGuardianViewMode;
    const assignedStudents = demo?.students ?? [];
    const aggregatedStudentCalendar = isMentorAccount && assignedStudents.length
      ? aggregateStudentCalendars(assignedStudents)
      : null;

    const resolvedProfile = resolveStudentProfile(profile, profileOverrides, isStudent, demo?.profile);
    const resolvedMentor = demo?.mentor ?? mentor ?? null;
    const resolvedApplicationProgress = demo?.applicationProgress
      ?? (useSupabase && onboarding?.profileComplete
        ? {
            collegeList: onboarding.profileComplete,
            essays: Math.max(0, onboarding.profileComplete - 10),
            extracurriculars: Math.max(0, onboarding.profileComplete - 20),
            scholarships: Math.max(0, onboarding.profileComplete - 30),
            profile: onboarding.profileComplete
          }
        : null);

    const resolvedDeadlines = demo?.deadlines?.length
      ? demo.deadlines
      : aggregatedStudentCalendar?.deadlines?.length
        ? aggregatedStudentCalendar.deadlines
        : (useSupabase ? supabaseDeadlines : []);

    const resolvedFixtureEvents = demo?.events?.length && !isMentorAccount
      ? demo.events
      : aggregatedStudentCalendar?.fixtureEvents?.length
        ? [...events, ...aggregatedStudentCalendar.fixtureEvents]
        : events;

    const resolvedUserCalendarEvents = aggregatedStudentCalendar?.userEvents?.length
      ? [...userCalendarEvents, ...aggregatedStudentCalendar.userEvents]
      : userCalendarEvents;

    const resolvedAcademicProgress = demo?.academicProgress
      ?? deriveAcademicProgress(resolvedProfile, resolvedApplicationProgress);

    const resolvedStudentProfileStats = demo?.studentProfileStats ?? null;
    const userTasks = (useSupabase ? supabaseTasks : localTasks) ?? [];
    const resolvedTasks = userTasks.length ? userTasks : (demo?.tasks ?? []);
    const userEssays = (useSupabase ? supabaseEssays : localEssays) ?? [];
    const resolvedEssays = userEssays.length ? userEssays : (demo?.essays ?? []);
    const resolvedSavedColleges = demo?.savedColleges ?? supabaseSavedColleges ?? savedColleges ?? [];
    const resolvedConversations = (() => {
      if (demo?.conversations?.length) return demo.conversations;

      let base = useSupabase
        ? conversations
        : conversations.length
          ? conversations
          : [];

      if (!base.length && localConversationMessages.length && resolvedMentor) {
        return buildMentorConversation(resolvedMentor, localConversationMessages, user?.name);
      }

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
      events: resolvedFixtureEvents,
      userCalendarEvents: resolvedUserCalendarEvents,
      persistCalendarItem: effectivePersistCalendarItem,
      deleteCalendarItem: effectiveDeleteCalendarItem,
      reloadLocalCalendar,
      mentorViewStudent,
      parentViewStudent,
      isMentorStudentView: isMentorStudentViewMode,
      isParentStudentView: isParentStudentViewMode,
      isGuardianViewMode,
      tasks: resolvedTasks,
      addTask: isGuardianViewMode ? async () => null : addTask,
      toggleTask: isGuardianViewMode ? async () => null : toggleTask,
      mentor: resolvedMentor,
      mentors,
      students: demo?.students ?? [],
      messages: demo?.messages ?? messages,
      conversations: resolvedConversations,
      gamification: demo?.gamification ?? null,
      progressRewards: demo?.progressRewards ?? null,
      studentActivityFeed: demo?.studentActivityFeed ?? [],
      essays: resolvedEssays,
      saveEssayDraft: isGuardianViewMode ? () => {} : saveEssayDraft,
      savedColleges: resolvedSavedColleges,
      updateSavedColleges: isGuardianViewMode ? async () => null : updateSavedColleges,
      extracurriculars: demo?.extracurriculars ?? [],
      aiSuggestions: demo?.aiSuggestions ?? [],
      profile: resolvedProfile,
      preferences,
      onboarding,
      savedResources,
      summaryCards: demo?.summaryCards ?? null,
      deadlines: resolvedDeadlines,
      applicationProgress: resolvedApplicationProgress,
      academicProgress: resolvedAcademicProgress,
      studentProfileStats: resolvedStudentProfileStats,
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
        startTime: m.startTime || m.start,
        endTime: m.endTime || m.end,
        type: m.title || "Meeting request"
        })),
        ...(demo?.pendingRequests ?? []).map((request) => ({
          ...request,
          startTime: request.startTime || parseRequestedTime(request.requestedTime)?.toISOString()
        }))
      ].filter((request) => !resolvedPendingRequestIds.includes(request.id)),
      availability: demo?.availability ?? [],
      privateNotes: demo?.privateNotes ?? {},
      refresh,
      scheduleMeeting: isGuardianViewMode ? async () => null : scheduleMeeting,
      acceptMeetingRequest: isGuardianViewMode ? () => null : acceptMeetingRequest,
      declineMeetingRequest: isGuardianViewMode ? () => {} : declineMeetingRequest,
      saveProfile: isGuardianViewMode ? async () => null : saveProfile,
      savePreferences: isGuardianViewMode ? async () => null : savePreferences,
      saveOnboarding: isGuardianViewMode ? async () => null : saveOnboarding,
      postMessage: isGuardianViewMode ? async () => null : postMessage,
      markAllNotificationsRead,
      saveUserResource: isGuardianViewMode ? async () => null : saveUserResource,
      connectGoogle: isGuardianViewMode
        ? async () => null
        : async () => {
        const r = await connectGoogleCalendar();
        setIntegrations(r.integrations);
      },
      disconnectGoogle: isGuardianViewMode
        ? async () => null
        : async () => {
        const r = await disconnectGoogleCalendar();
        setIntegrations(r.integrations);
      },
      connectZoomAccount: isGuardianViewMode
        ? async () => null
        : async () => {
        const r = await connectZoom();
        setIntegrations(r.integrations);
      },
      disconnectZoomAccount: isGuardianViewMode
        ? async () => null
        : async () => {
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
      resolvedPendingRequestIds,
      notifications,
      events,
      userCalendarEvents,
      studentSyncTick,
      localTasks,
      localEssays,
      supabaseTasks,
      supabaseEssays,
      supabaseDeadlines,
      supabaseSavedColleges,
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
      effectivePersistCalendarItem,
      effectiveDeleteCalendarItem,
      reloadLocalCalendar,
      mentorViewStudent,
      addTask,
      toggleTask,
      saveEssayDraft,
      updateSavedColleges,
      refresh,
      scheduleMeeting,
      acceptMeetingRequest,
      declineMeetingRequest,
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
