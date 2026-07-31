/**
 * LOCAL DEVELOPMENT ONLY — rich dashboard fixtures for demo accounts.
 * Replace with database-backed records when production data is available.
 */

import { DEMO_MENTOR, DEMO_STUDENT, DEMO_STUDENT_2, isJordanDemoEmail, JORDAN_DEMO_ACCOUNTS } from "./demoAccounts.js";
import { conversationsToInbox, getDemoConversations } from "../dashboard/data/demoConversations.js";
import { buildDefaultGamification } from "../dashboard/data/gamification.js";
import { buildDefaultProgressRewards } from "../dashboard/lib/progressRewards.js";

/** Stable slugs used in events/meetings before DB IDs are known. */
export const DEMO_SLUGS = {
  mentor: "demo-mentor-asim",
  jordanEssay: "demo-student-jordan-essay",
  jordanPlus: "demo-student-jordan-plus",
  jordanPro: "demo-student-jordan-pro",
  /** @deprecated Prefer jordanEssay — kept for older fixtures/links. */
  jordan: "demo-student-jordan-essay",
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

function atDayOffset(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildUpcomingDemoEvents(slug) {
  const mentorToday = atDayOffset(0, 16, 0);
  const calcToday = atDayOffset(0, 18, 30);
  const roboticsTomorrow = atDayOffset(1, 15, 30);
  const scholarshipTomorrow = atDayOffset(1, 9, 0);

  return [
    {
      id: "demo-upcoming-mentor",
      title: "Mentor Meeting",
      category: "mentor_meeting",
      start: mentorToday.toISOString(),
      end: meetingEnd(mentorToday, 60).toISOString(),
      studentId: slug,
      shared: true
    },
    {
      id: "demo-upcoming-calc",
      title: "AP Calculus Review",
      category: "personal_task",
      start: calcToday.toISOString(),
      end: meetingEnd(calcToday, 90).toISOString(),
      studentId: slug,
      shared: true
    },
    {
      id: "demo-upcoming-robotics",
      title: "Robotics Club Meeting",
      category: "personal_task",
      start: roboticsTomorrow.toISOString(),
      end: meetingEnd(roboticsTomorrow, 90).toISOString(),
      studentId: slug,
      shared: true
    },
    {
      id: "demo-upcoming-scholarship",
      title: "Scholarship Deadline",
      category: "scholarship_deadline",
      start: scholarshipTomorrow.toISOString(),
      end: scholarshipTomorrow.toISOString(),
      studentId: slug,
      shared: true
    }
  ];
}

const jordanMeetingStart = futureMeetingStart(9, 16, 0);
const jordanPlusMeetingStart = futureMeetingStart(11, 15, 30);
const jordanProMeetingStart = futureMeetingStart(14, 15, 30);

const SHARED_MENTOR = {
  id: DEMO_SLUGS.mentor,
  mentorUserId: DEMO_SLUGS.mentor,
  userId: DEMO_SLUGS.mentor,
  name: "Asim Yoonas",
  university: "Georgia Institute of Technology",
  college: "Georgia Institute of Technology",
  universityId: "georgia-tech",
  major: "Computer Science",
  graduationYear: "2027",
  headshot: `${import.meta.env.BASE_URL}media/mentors/asim-yoonas.png`,
  avatarUrl: `${import.meta.env.BASE_URL}media/mentors/asim-yoonas.png`,
  objectPosition: "50% 28%",
  universityLogo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Georgia_Tech_Yellow_Jackets_logo.svg/240px-Georgia_Tech_Yellow_Jackets_logo.svg.png",
  bio: "Asim is a Georgia Tech student who helps students organize their college applications, strengthen their essays, and create realistic college lists.",
  specialties: ["Application strategy", "Essay brainstorming", "Academic profile review"],
  targetMajors: ["Computer science", "Engineering"],
  targetSchools: ["Emory University", "University of Georgia", "Georgia Institute of Technology"],
  supportStyles: ["Structured step-by-step guidance", "Accountability and check-ins"],
  expertise: ["Application strategy", "Essay brainstorming", "Academic profile review"],
  availability: "Mon 09:00 – 17:00 · Tue 14:00 – 18:00 · Wed 16:00 – 20:00 · Thu 13:00 – 17:00 · Fri 09:00 – 13:00 ET",
  availabilitySchedule: {
    timezone: "ET",
    days: [
      { dayOfWeek: "Monday", enabled: true, startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: "Tuesday", enabled: true, startTime: "14:00", endTime: "18:00" },
      { dayOfWeek: "Wednesday", enabled: true, startTime: "16:00", endTime: "20:00" },
      { dayOfWeek: "Thursday", enabled: true, startTime: "13:00", endTime: "17:00" },
      { dayOfWeek: "Friday", enabled: true, startTime: "09:00", endTime: "13:00" },
      { dayOfWeek: "Saturday", enabled: false, startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: "Sunday", enabled: false, startTime: "09:00", endTime: "17:00" }
    ]
  }
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
  mentorName: "Asim Yoonas"
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
  mentorName: "Asim Yoonas"
};

function buildMeetings() {
  return [
    {
      id: "demo-meet-jordan-essay-zoom",
      title: "Essay Support Check-in",
      studentId: DEMO_SLUGS.jordanEssay,
      mentorId: DEMO_SLUGS.mentor,
      meetingType: "zoom",
      startTime: jordanMeetingStart.toISOString(),
      endTime: meetingEnd(jordanMeetingStart, 45).toISOString(),
      timeZone: "America/New_York",
      status: "scheduled",
      notes: "Review personal statement draft and Brown supplemental prompts.",
      isPrivate: false
    },
    {
      id: "demo-meet-jordan-plus-zoom",
      title: "College List Strategy Session",
      studentId: DEMO_SLUGS.jordanPlus,
      mentorId: DEMO_SLUGS.mentor,
      meetingType: "zoom",
      startTime: jordanPlusMeetingStart.toISOString(),
      endTime: meetingEnd(jordanPlusMeetingStart, 45).toISOString(),
      timeZone: "America/New_York",
      status: "scheduled",
      notes: "Review reach/target/likely balance and summer essay plan.",
      isPrivate: false
    },
    {
      id: "demo-meet-jordan-pro-zoom",
      title: "Pro Strategy Session",
      studentId: DEMO_SLUGS.jordanPro,
      mentorId: DEMO_SLUGS.mentor,
      meetingType: "zoom",
      startTime: jordanProMeetingStart.toISOString(),
      endTime: meetingEnd(jordanProMeetingStart, 45).toISOString(),
      timeZone: "America/New_York",
      status: "scheduled",
      notes: "Priority mentoring for applications timeline and interview prep.",
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

function buildPrepEvents() {
  return [
    {
      id: "demo-prep-ap",
      title: "AP Calculus BC Exam",
      category: "personal_task",
      start: futureMeetingStart(14).toISOString(),
      end: futureMeetingStart(14).toISOString(),
      shared: true
    },
    {
      id: "demo-prep-sat",
      title: "SAT Test Date",
      category: "personal_task",
      start: futureMeetingStart(10).toISOString(),
      end: futureMeetingStart(10).toISOString(),
      shared: true
    },
    {
      id: "demo-prep-club",
      title: "Robotics Club Meeting",
      category: "personal_task",
      start: futureMeetingStart(5, 15, 30).toISOString(),
      end: meetingEnd(futureMeetingStart(5, 15, 30), 90).toISOString(),
      shared: true
    },
    {
      id: "demo-prep-visit",
      title: "Georgia Tech Campus Visit",
      category: "personal_task",
      start: futureMeetingStart(16).toISOString(),
      end: futureMeetingStart(16).toISOString(),
      shared: true
    },
    {
      id: "demo-prep-summer",
      title: "MITES Summer Program Deadline",
      category: "scholarship_deadline",
      start: futureMeetingStart(22).toISOString(),
      end: futureMeetingStart(22).toISOString(),
      shared: true
    }
  ];
}

function buildApplicationEvents(slug) {
  return [
    {
      id: "demo-app-common",
      title: "Common App Opens",
      category: "application_deadline",
      start: futureMeetingStart(6).toISOString(),
      end: futureMeetingStart(6).toISOString(),
      shared: true,
      studentId: slug
    },
    {
      id: "demo-app-uc",
      title: "UC Application",
      category: "application_deadline",
      start: futureMeetingStart(20).toISOString(),
      end: futureMeetingStart(20).toISOString(),
      shared: true,
      studentId: slug
    },
    {
      id: "demo-app-fafsa",
      title: "FAFSA Priority Deadline",
      category: "scholarship_deadline",
      start: futureMeetingStart(12).toISOString(),
      end: futureMeetingStart(12).toISOString(),
      shared: true,
      studentId: slug
    },
    {
      id: "demo-app-css",
      title: "CSS Profile",
      category: "scholarship_deadline",
      start: futureMeetingStart(15).toISOString(),
      end: futureMeetingStart(15).toISOString(),
      shared: true,
      studentId: slug
    },
    {
      id: "demo-app-supplement",
      title: "Georgia Tech Supplement",
      category: "essay_deadline",
      start: futureMeetingStart(18).toISOString(),
      end: futureMeetingStart(18).toISOString(),
      shared: true,
      studentId: slug
    }
  ];
}

function buildAvailabilityEvents() {
  const tueStart = futureMeetingStart(2, 16, 0);
  const thuStart = futureMeetingStart(4, 15, 0);
  return [
    {
      id: "demo-av-tue",
      title: "Asim Yoonas — Office hours",
      category: "mentor_availability",
      start: tueStart.toISOString(),
      end: meetingEnd(tueStart, 120).toISOString(),
      shared: true,
      description: "Open availability for mentor sessions."
    },
    {
      id: "demo-av-thu",
      title: "Asim Yoonas — Office hours",
      category: "mentor_availability",
      start: thuStart.toISOString(),
      end: meetingEnd(thuStart, 120).toISOString(),
      shared: true,
      description: "Open availability for mentor sessions."
    }
  ];
}

function studentBundle(email) {
  const isJordan = isJordanDemoEmail(email);
  const profile = isJordan ? JORDAN_PROFILE : ALEX_PROFILE;
  const slug = profile.slug;
  const meetings = buildMeetings().filter((m) => m.studentId === slug);
  const conversations = getDemoConversations("student", isJordan ? "jordan" : "alex");
  const gamification = buildDefaultGamification(isJordan);
  const progressRewards = buildDefaultProgressRewards(isJordan);

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
      ...(isJordan ? [...buildPrepEvents(), ...buildUpcomingDemoEvents(slug)] : buildApplicationEvents(slug))
    ],
    conversations,
    gamification,
    progressRewards,
    tasks: isJordan
      ? [
          { id: "t-j1", title: "Finalize reach school essay prompts", priority: "high", done: false },
          { id: "t-j2", title: "Update robotics club description", priority: "medium", done: false },
          { id: "t-j3", title: "Prepare questions for Asim", priority: "medium", done: true }
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
          "Consider taking AP Statistics next year.",
          "Join a leadership role within FBLA.",
          "Research engineering summer programs.",
          "Add one community service activity this semester.",
          "Build a stronger spike in computer science."
        ]
      : [
          "Finish your Georgia Tech supplement.",
          "Submit FAFSA before the priority deadline.",
          "Complete your activities section.",
          "Review your essay before your mentor meeting."
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
          { id: "dl-1", title: "AP Calculus BC Exam", dueDate: "May 5, 2026", category: "Academic", priority: "high", done: false },
          { id: "dl-2", title: "SAT Test Date", dueDate: "Apr 12, 2026", category: "Academic", priority: "high", done: false },
          { id: "dl-3", title: "MITES Summer Program", dueDate: "Mar 15, 2026", category: "Summer Program", priority: "medium", done: false },
          { id: "dl-4", title: "Course registration", dueDate: "Mar 28, 2026", category: "Academic", priority: "low", done: true }
        ]
      : [
          { id: "dl-a1", title: "NYU supplement draft", dueDate: "Apr 8, 2026", category: "Essay", priority: "high", done: false },
          { id: "dl-a2", title: "FAFSA verification", dueDate: "Apr 15, 2026", category: "Application", priority: "high", done: false },
          { id: "dl-a3", title: "Merit scholarship packet", dueDate: "May 10, 2026", category: "Scholarship", priority: "medium", done: false }
        ],
    applicationProgress: isJordan
      ? { collegeList: 72, essays: 68, extracurriculars: 55, scholarships: 40, profile: 78 }
      : { collegeList: 60, essays: 54, extracurriculars: 70, scholarships: 35, profile: 64 },
    academicProgress: isJordan
      ? { gpaStrength: 96, courseRigor: 89, activities: 78, leadership: 72 }
      : null,
    studentProfileStats: isJordan
      ? { gpa: "3.86", apHonors: 6, leadershipRoles: 2, volunteerHours: 84 }
      : null,
    collegeJourney: isJordan
      ? [
          { id: "j1", label: "First extracurricular joined", done: true },
          { id: "j2", label: "First leadership role", done: true },
          { id: "j3", label: "First AP course", done: true },
          { id: "j4", label: "SAT completed", done: false },
          { id: "j5", label: "College visit completed", done: false },
          { id: "j6", label: "College applications submitted", done: false }
        ]
      : [],
    essayTracker: isJordan
      ? []
      : [
          { id: "et-1", title: "Personal Statement", status: "In Progress" },
          { id: "et-2", title: "Common App Essay", status: "Completed" },
          { id: "et-3", title: "Supplement Essays", status: "In Progress" }
        ],
    financialAidTracker: isJordan
      ? []
      : [
          { id: "fa-1", label: "FAFSA", status: "In Progress", value: 72 },
          { id: "fa-2", label: "CSS Profile", status: "In Progress", value: 45 },
          { id: "fa-3", label: "Scholarships Found", status: "In Progress", value: 12 },
          { id: "fa-4", label: "Scholarships Submitted", status: "In Progress", value: 4 }
        ]
  };
}

function mentorBundle() {
  const meetings = buildMeetings();
  const conversations = getDemoConversations("mentor");
  return {
    mentor: SHARED_MENTOR,
    students: [
      {
        id: DEMO_SLUGS.jordanEssay,
        name: "Jordan Lee",
        displayName: "Jordan — Essay Support",
        grade: "11th",
        major: "Computer Science",
        plan: "basic",
        planLabel: "Essay Support",
        paymentType: "one_time",
        essaySupportOnly: true,
        reviewCredits: { purchased: 6, assigned: 2, remaining: 4 },
        usageSummary: "4 review credits remaining",
        profileCompletion: 78,
        upcomingDeadlines: 4,
        lastMeeting: "May 28, 2026",
        nextMeeting: "Jun 28, 2026",
        applicationPhase: "researching",
        priorities: ["Personal statement review", "Brown supplemental essays"],
        gamification: { ...buildDefaultGamification(true), streak: 5 }
      },
      {
        id: DEMO_SLUGS.jordanPlus,
        name: "Jordan Lee",
        displayName: "Jordan — Plus",
        grade: "11th",
        major: "Computer Science",
        plan: "plus",
        planLabel: "Plus",
        paymentType: "monthly",
        essaySupportOnly: false,
        sessionAllowance: { included: 2, used: 1, remaining: 1 },
        usageSummary: "1 of 2 sessions remaining",
        profileCompletion: 78,
        upcomingDeadlines: 4,
        lastMeeting: "May 28, 2026",
        nextMeeting: "Jun 30, 2026",
        applicationPhase: "researching",
        priorities: ["Finalize college list", "Flexible session planning"],
        gamification: { ...buildDefaultGamification(true), streak: 5 }
      },
      {
        id: DEMO_SLUGS.jordanPro,
        name: "Jordan Lee",
        displayName: "Jordan — Pro",
        grade: "11th",
        major: "Computer Science",
        plan: "pro",
        planLabel: "Pro",
        paymentType: "monthly",
        essaySupportOnly: false,
        sessionAllowance: { included: 4, used: 1, remaining: 3 },
        usageSummary: "3 of 4 sessions remaining",
        profileCompletion: 82,
        upcomingDeadlines: 3,
        lastMeeting: "Jun 2, 2026",
        nextMeeting: "Jul 1, 2026",
        applicationPhase: "applying",
        priorities: ["Full application review", "Interview prep"],
        gamification: { ...buildDefaultGamification(true), streak: 7 }
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
      {
        id: "av-mon",
        day: "Monday",
        startTime: "09:00",
        endTime: "17:00",
        timezone: "ET",
        time: "9:00 AM – 5:00 PM ET",
        recurring: true,
        active: true
      },
      {
        id: "av-tue",
        day: "Tuesday",
        startTime: "14:00",
        endTime: "18:00",
        timezone: "ET",
        time: "2:00 PM – 6:00 PM ET",
        recurring: true,
        active: true
      },
      {
        id: "av-wed",
        day: "Wednesday",
        startTime: "16:00",
        endTime: "20:00",
        timezone: "ET",
        time: "4:00 PM – 8:00 PM ET",
        recurring: true,
        active: true
      },
      {
        id: "av-thu",
        day: "Thursday",
        startTime: "13:00",
        endTime: "17:00",
        timezone: "ET",
        time: "1:00 PM – 5:00 PM ET",
        recurring: true,
        active: true
      },
      {
        id: "av-fri",
        day: "Friday",
        startTime: "09:00",
        endTime: "13:00",
        timezone: "ET",
        time: "9:00 AM – 1:00 PM ET",
        recurring: true,
        active: true
      }
    ],
    privateNotes: {
      [DEMO_SLUGS.jordanEssay]: "Essay Support — 4 of 6 review credits remaining. Focus on personal statement specificity and Brown Open Curriculum prompts.",
      [DEMO_SLUGS.jordanPlus]: "Plus — 1 of 2 flexible sessions remaining this month. Strong STEM narrative; encourage measurable activity descriptions.",
      [DEMO_SLUGS.jordanPro]: "Pro — 3 of 4 flexible sessions remaining this month. Ready for full application review and interview prep."
    },
    conversations,
    messages: conversationsToInbox(conversations),
    summaryCards: {
      students: 3,
      meetingsThisWeek: 3,
      pendingRequests: 1,
      unreadMessages: 1,
      upcomingDeadlines: 4,
      upcomingBookings: 3
    },
    pendingRequests: [
      {
        id: "req-1",
        studentName: "Jordan — Essay Support",
        studentId: DEMO_SLUGS.jordanEssay,
        requestedTime: "Thu, Jun 12 · 4:30 PM ET",
        type: "Essay review check-in"
      }
    ],
    studentActivityFeed: [
      { id: "sf1", studentName: "Jordan — Essay Support", text: "Opened personal statement review", sub: "1 credit assigned", time: "2h ago" },
      { id: "sf2", studentName: "Jordan — Plus", text: "Booked flexible session", sub: "1 of 2 remaining", time: "5h ago" },
      { id: "sf3", studentName: "Jordan — Pro", text: "Completed mission", sub: "+30 XP", time: "Yesterday" },
      { id: "sf4", studentName: "Jordan — Essay Support", text: "Brown supplemental assigned", sub: "3 prompts · 1 credit", time: "Yesterday" }
    ]
  };
}

const BUNDLES = {
  [DEMO_STUDENT_2.email]: () => studentBundle(DEMO_STUDENT_2.email),
  [DEMO_MENTOR.email]: () => mentorBundle()
};

for (const account of JORDAN_DEMO_ACCOUNTS) {
  BUNDLES[account.email] = (role) => (role === "MENTOR" ? mentorBundle() : studentBundle(account.email));
}

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
