/**
 * LOCAL DEVELOPMENT ONLY — rich dashboard fixtures for demo accounts.
 * Replace with database-backed records when production data is available.
 */

import { DEMO_MENTOR, DEMO_STUDENT, DEMO_STUDENT_2 } from "./demoAccounts.js";
import { conversationsToInbox, getDemoConversations } from "../dashboard/data/demoConversations.js";
import { buildDefaultGamification, levelFromXp } from "../dashboard/data/gamification.js";

/** Stable slugs used in events/meetings before DB IDs are known. */
export const DEMO_SLUGS = {
  mentor: "demo-mentor-maya",
  jordan: "demo-student-jordan",
  alex: "demo-student-alex"
};

function futureMeetingStart(daysAhead, hour = 16, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function meetingEnd(start, minutes) {
  return new Date(start.getTime() + minutes * 60 * 1000);
}

const jordanMeetingStart = futureMeetingStart(9, 16, 0);
const alexMeetingStart = futureMeetingStart(14, 15, 30);

const SHARED_MENTOR = {
  id: DEMO_SLUGS.mentor,
  name: "Maya Patel",
  university: "Georgia Institute of Technology",
  major: "Computer Science",
  graduationYear: "2024",
  bio: "Maya is a Georgia Tech graduate who helps students organize their college applications, strengthen their essays, and create realistic college lists.",
  expertise: ["STEM applications", "College list strategy", "Essay feedback", "Scholarship planning", "Time management"],
  availability: "Tuesdays 4–6 PM ET · Thursdays 3–5 PM ET"
};

const JORDAN_PROFILE = {
  slug: DEMO_SLUGS.jordan,
  grade: "11th grade",
  graduationYear: 2027,
  gpa: 3.86,
  weightedGpa: 4.21,
  sat: 1420,
  majors: ["Computer Science", "Data Science"],
  colleges: ["Georgia Tech", "UCLA", "University of Michigan", "Northeastern University", "University of Georgia"],
  profileCompletion: 78,
  mentorName: "Maya Patel"
};

const ALEX_PROFILE = {
  slug: DEMO_SLUGS.alex,
  grade: "12th grade",
  graduationYear: 2026,
  gpa: 3.72,
  weightedGpa: 4.05,
  sat: 1360,
  majors: ["Economics", "Business"],
  colleges: ["NYU", "Boston University", "Emory University", "University of Georgia"],
  profileCompletion: 64,
  mentorName: "Maya Patel"
};

function buildMeetings() {
  return [
    {
      id: "demo-meet-jordan-zoom",
      title: "College List Strategy Session",
      studentId: DEMO_SLUGS.jordan,
      mentorId: DEMO_SLUGS.mentor,
      meetingType: "zoom",
      startTime: jordanMeetingStart.toISOString(),
      endTime: meetingEnd(jordanMeetingStart, 45).toISOString(),
      timeZone: "America/New_York",
      zoomMeetingId: "1234567890",
      zoomJoinUrl: "https://zoom.us/j/1234567890",
      zoomHostUrl: "https://zoom.us/s/demo-host-jordan",
      status: "scheduled",
      notes: "Review reach/target/likely balance and summer essay plan.",
      isPrivate: false
    },
    {
      id: "demo-meet-alex-zoom",
      title: "Scholarship & Essay Planning",
      studentId: DEMO_SLUGS.alex,
      mentorId: DEMO_SLUGS.mentor,
      meetingType: "zoom",
      startTime: alexMeetingStart.toISOString(),
      endTime: meetingEnd(alexMeetingStart, 45).toISOString(),
      timeZone: "America/New_York",
      zoomMeetingId: "9876543210",
      zoomJoinUrl: "https://zoom.us/j/9876543210",
      zoomHostUrl: "https://zoom.us/s/demo-host-alex",
      status: "scheduled",
      notes: "Outline scholarship targets and personal statement themes.",
      isPrivate: false
    }
  ];
}

const MENTOR_PRIVATE_EVENTS = [
  {
    id: "demo-evt-private-1",
    title: "Mentor planning block",
    category: "mentor_private",
    start: futureMeetingStart(3, 14, 0).toISOString(),
    end: futureMeetingStart(3, 15, 0).toISOString(),
    mentorOnly: true,
    shared: false
  },
  {
    id: "demo-evt-private-2",
    title: "Grad school application research",
    category: "mentor_private",
    start: futureMeetingStart(6, 10, 0).toISOString(),
    end: futureMeetingStart(6, 11, 30).toISOString(),
    mentorOnly: true,
    shared: false
  }
];

function buildAvailabilityEvents() {
  const tueStart = futureMeetingStart(2, 16, 0);
  const thuStart = futureMeetingStart(4, 15, 0);
  return [
    {
      id: "demo-av-tue",
      title: "Maya Patel — Office hours",
      category: "mentor_availability",
      start: tueStart.toISOString(),
      end: meetingEnd(tueStart, 120).toISOString(),
      shared: true,
      description: "Open availability for mentor sessions."
    },
    {
      id: "demo-av-thu",
      title: "Maya Patel — Office hours",
      category: "mentor_availability",
      start: thuStart.toISOString(),
      end: meetingEnd(thuStart, 120).toISOString(),
      shared: true,
      description: "Open availability for mentor sessions."
    }
  ];
}

function studentBundle(email) {
  const isJordan = email === DEMO_STUDENT.email;
  const profile = isJordan ? JORDAN_PROFILE : ALEX_PROFILE;
  const slug = profile.slug;
  const meetings = buildMeetings().filter((m) => m.studentId === slug);
  const conversations = getDemoConversations("student", isJordan ? "jordan" : "alex");
  const gamification = buildDefaultGamification(isJordan);

  return {
    profile,
    mentor: SHARED_MENTOR,
    meetings,
    events: [
      ...meetings.map((m) => ({
        id: m.id,
        title: m.title,
        category: "mentor_meeting",
        start: m.startTime,
        end: m.endTime,
        studentId: slug,
        shared: true,
        zoomJoinUrl: m.zoomJoinUrl
      })),
      {
        id: "demo-deadline-ps",
        title: isJordan ? "Draft personal statement" : "Revise personal statement",
        category: "essay_deadline",
        start: futureMeetingStart(12).toISOString(),
        end: futureMeetingStart(12).toISOString(),
        shared: true
      },
      {
        id: "demo-deadline-ec",
        title: "Update extracurricular activities list",
        category: "personal_task",
        start: futureMeetingStart(8).toISOString(),
        end: futureMeetingStart(8).toISOString(),
        shared: true
      },
      {
        id: "demo-deadline-scholarship",
        title: "Review scholarship opportunities",
        category: "scholarship_deadline",
        start: futureMeetingStart(18).toISOString(),
        end: futureMeetingStart(18).toISOString(),
        shared: true
      },
      {
        id: "demo-deadline-app",
        title: isJordan ? "UC application opens" : "Early action deadline",
        category: "application_deadline",
        start: futureMeetingStart(20).toISOString(),
        end: futureMeetingStart(20).toISOString(),
        shared: true,
        studentId: slug
      },
      ...buildAvailabilityEvents()
    ],
    conversations,
    gamification,
    tasks: isJordan
      ? [
          { id: "t-j1", title: "Finalize reach school essay prompts", priority: "high", done: false },
          { id: "t-j2", title: "Update robotics club description", priority: "medium", done: false },
          { id: "t-j3", title: "Prepare questions for Maya", priority: "medium", done: true }
        ]
      : [
          { id: "t-a1", title: "Complete FAFSA checklist", priority: "high", done: false },
          { id: "t-a2", title: "Draft scholarship essay outline", priority: "high", done: false },
          { id: "t-a3", title: "Send mentor updated college list", priority: "medium", done: false }
        ],
    essays: isJordan
      ? [
          { id: "e-j1", title: "Personal Statement", words: 428, status: "Draft in progress", updatedAt: "Jun 2" },
          { id: "e-j2", title: "Georgia Tech Supplemental Essay", words: 0, status: "Not started", updatedAt: "—" }
        ]
      : [
          { id: "e-a1", title: "Personal Statement", words: 510, status: "Revision needed", updatedAt: "Jun 1" },
          { id: "e-a2", title: "NYU Supplement", words: 120, status: "Draft in progress", updatedAt: "May 28" }
        ],
    extracurriculars: isJordan
      ? ["Robotics Club", "Coding Club", "Community Volunteer Tutor"]
      : ["DECA", "Student Government", "Part-time retail associate"],
    aiSuggestions: isJordan
      ? [
          "Prioritize your personal statement draft before next week's mentor session.",
          "Add one more target school with a strong CS co-op program.",
          "Block 2 hours this weekend to refine your extracurricular descriptions."
        ]
      : [
          "Confirm scholarship deadlines for your top three schools.",
          "Ask Maya to review your personal statement introduction.",
          "Schedule time to update your college list categories."
        ],
    messages: conversationsToInbox(conversations),
    summaryCards: isJordan
      ? {
          deadlines: 4,
          meetings: 1,
          essayProgress: "68%",
          profileCompletion: 78
        }
      : {
          deadlines: 5,
          meetings: 1,
          essayProgress: "54%",
          profileCompletion: 64
        },
    deadlines: isJordan
      ? [
          { id: "dl-1", title: "Personal statement draft", dueDate: "Apr 12, 2026", category: "Essay", priority: "high", done: false },
          { id: "dl-2", title: "Georgia Tech supplemental", dueDate: "Apr 18, 2026", category: "Essay", priority: "medium", done: false },
          { id: "dl-3", title: "Scholarship essay — STEM", dueDate: "May 2, 2026", category: "Scholarship", priority: "medium", done: false },
          { id: "dl-4", title: "Update activities list", dueDate: "Mar 28, 2026", category: "Application", priority: "low", done: true }
        ]
      : [
          { id: "dl-a1", title: "NYU supplement draft", dueDate: "Apr 8, 2026", category: "Essay", priority: "high", done: false },
          { id: "dl-a2", title: "FAFSA verification", dueDate: "Apr 15, 2026", category: "Application", priority: "high", done: false },
          { id: "dl-a3", title: "Merit scholarship packet", dueDate: "May 10, 2026", category: "Scholarship", priority: "medium", done: false }
        ],
    applicationProgress: isJordan
      ? { collegeList: 72, essays: 68, extracurriculars: 55, scholarships: 40, profile: 78 }
      : { collegeList: 60, essays: 54, extracurriculars: 70, scholarships: 35, profile: 64 }
  };
}

function mentorBundle() {
  const meetings = buildMeetings();
  const conversations = getDemoConversations("mentor");
  return {
    mentor: SHARED_MENTOR,
    students: [
      {
        id: DEMO_SLUGS.jordan,
        name: "Jordan Lee",
        grade: "11th",
        major: "Computer Science",
        profileCompletion: 78,
        upcomingDeadlines: 4,
        lastMeeting: "May 28, 2026",
        nextMeeting: jordanMeetingStart.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        priorities: ["Finalize college list", "Personal statement draft"],
        gamification: { ...buildDefaultGamification(true), level: levelFromXp(420) },
        needsAttention: true
      },
      {
        id: DEMO_SLUGS.alex,
        name: "Alex Kim",
        grade: "12th",
        major: "Economics",
        profileCompletion: 64,
        upcomingDeadlines: 5,
        lastMeeting: "May 30, 2026",
        nextMeeting: alexMeetingStart.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        priorities: ["Scholarship essays", "FAFSA follow-up"],
        gamification: { ...buildDefaultGamification(false), level: levelFromXp(285) },
        needsAttention: false
      }
    ],
    meetings,
    events: [
      ...meetings.map((m) => ({
        id: m.id,
        title: m.title,
        category: "mentor_meeting",
        start: m.startTime,
        end: m.endTime,
        studentId: m.studentId,
        shared: true,
        zoomJoinUrl: m.zoomJoinUrl
      })),
      ...MENTOR_PRIVATE_EVENTS
    ],
    availability: [
      { id: "av-1", day: "Tuesday", time: "4:00–6:00 PM ET", active: true },
      { id: "av-2", day: "Thursday", time: "3:00–5:00 PM ET", active: true },
      { id: "av-3", day: "Saturday", time: "Unavailable", active: false }
    ],
    privateNotes: {
      [DEMO_SLUGS.jordan]: "Strong STEM narrative — encourage more specificity in activity descriptions. Watch essay tone in paragraph 2.",
      [DEMO_SLUGS.alex]: "Needs tighter scholarship timeline. Personal statement opening is solid but conclusion is vague."
    },
    conversations,
    messages: conversationsToInbox(conversations),
    summaryCards: {
      students: 2,
      meetingsThisWeek: 2,
      pendingRequests: 1,
      unreadMessages: 1,
      upcomingDeadlines: 6
    },
    pendingRequests: [
      {
        id: "req-1",
        studentName: "Jordan Lee",
        studentId: DEMO_SLUGS.jordan,
        requestedTime: "Thu, Jun 12 · 4:30 PM ET",
        type: "Zoom check-in"
      }
    ],
    studentActivityFeed: [
      { id: "sf1", studentName: "Jordan Lee", text: "Finished essay draft", sub: "Personal Statement v2", time: "2h ago" },
      { id: "sf2", studentName: "Alex Kim", text: "Added colleges", sub: "3 schools updated", time: "5h ago" },
      { id: "sf3", studentName: "Jordan Lee", text: "Completed mission", sub: "+30 XP", time: "Yesterday" },
      { id: "sf4", studentName: "Alex Kim", text: "Requested feedback", sub: "Scholarship essay", time: "Yesterday" }
    ]
  };
}

const BUNDLES = {
  [DEMO_STUDENT.email]: (role) => (role === "MENTOR" ? mentorBundle() : studentBundle(DEMO_STUDENT.email)),
  [DEMO_STUDENT_2.email]: () => studentBundle(DEMO_STUDENT_2.email),
  [DEMO_MENTOR.email]: () => mentorBundle()
};

export function getDemoDashboardForUser(email, role) {
  const key = (email || "").trim().toLowerCase();
  const factory = BUNDLES[key];
  if (!factory) return null;
  return factory((role || "").toUpperCase());
}

export function getDemoMeetingsForEmail(email, role, userId) {
  const bundle = getDemoDashboardForUser(email, role);
  if (!bundle?.meetings) return [];
  return bundle.meetings.map((m) => ({
    ...m,
    studentUserId: role === "STUDENT" ? userId : m.studentUserId ?? null,
    mentorUserId: role === "MENTOR" ? userId : m.mentorUserId ?? null
  }));
}

/** Used by seed script to persist meetings with real user IDs. */
export function getDemoMeetingsSeedPayload() {
  return buildMeetings();
}

export { DEMO_STUDENT, DEMO_STUDENT_2, DEMO_MENTOR, JORDAN_PROFILE, ALEX_PROFILE, SHARED_MENTOR };
