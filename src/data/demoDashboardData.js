/**
 * LOCAL DEVELOPMENT ONLY — rich dashboard fixtures for demo accounts.
 * Replace with database-backed records when production data is available.
 */

import { DEMO_MENTOR, DEMO_STUDENT, DEMO_STUDENT_2 } from "./demoAccounts.js";
import { conversationsToInbox, getDemoConversations } from "../dashboard/data/demoConversations.js";
import { buildDefaultGamification } from "../dashboard/data/gamification.js";
import { buildDefaultProgressRewards } from "../dashboard/lib/progressRewards.js";

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
      shared: true,
      zoomJoinUrl: "https://zoom.us/j/1234567890"
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
const alexMeetingStart = futureMeetingStart(14, 15, 30);

const SHARED_MENTOR = {
  id: DEMO_SLUGS.mentor,
  name: "Maya Patel",
  university: "Georgia Institute of Technology",
  universityId: "georgia-tech",
  major: "Computer Science",
  graduationYear: "2024",
  headshot: `${import.meta.env.BASE_URL}media/mentors/moon-headshot.png`,
  universityLogo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Georgia_Tech_Yellow_Jackets_logo.svg/240px-Georgia_Tech_Yellow_Jackets_logo.svg.png",
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
    opportunities: isJordan
      ? [
          {
            id: "opp-1",
            title: "MITES Summer Program",
            category: "Summer Program",
            deadline: "Mar 15",
            matchScore: 95,
            description: "STEM enrichment program for high-achieving students.",
            actionLabel: "Learn more"
          },
          {
            id: "opp-2",
            title: "Research Opportunity — GT Lab",
            category: "Research",
            deadline: "Apr 5",
            matchScore: 92,
            description: "Explore hands-on research experience with a university lab.",
            actionLabel: "Apply"
          },
          {
            id: "opp-3",
            title: "FBLA State Competition",
            category: "Competition",
            deadline: "Apr 2",
            matchScore: 88,
            description: "Compete and build leadership through business events.",
            actionLabel: "Register"
          },
          {
            id: "opp-4",
            title: "Coding Internship",
            category: "Internship",
            deadline: "May 1",
            matchScore: 84,
            description: "Gain real-world experience in software development.",
            actionLabel: "View"
          }
        ]
      : [],
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
        id: DEMO_SLUGS.alex,
        name: "Alex Kim",
        grade: "12th",
        major: "Economics",
        profileCompletion: 64,
        upcomingDeadlines: 5,
        lastMeeting: "May 30, 2026",
        nextMeeting: "Jul 1, 2026",
        applicationPhase: "applying",
        priorities: ["Scholarship essays", "FAFSA follow-up"],
        gamification: { ...buildDefaultGamification(false), streak: 3 }
      },
      {
        id: DEMO_SLUGS.jordan,
        name: "Jordan Lee",
        grade: "11th",
        major: "Computer Science",
        profileCompletion: 78,
        upcomingDeadlines: 4,
        lastMeeting: "May 28, 2026",
        nextMeeting: "Jun 28, 2026",
        applicationPhase: "researching",
        priorities: ["Finalize college list", "Personal statement draft"],
        gamification: { ...buildDefaultGamification(true), streak: 5 }
      },
      {
        id: "student-demo-maya",
        name: "Maya Chen",
        grade: "12th",
        major: "English Literature",
        profileCompletion: 71,
        upcomingDeadlines: 2,
        lastMeeting: "Jun 2, 2026",
        nextMeeting: "Jul 8, 2026",
        applicationPhase: "applying",
        priorities: ["Supplement essays", "Interview prep"],
        gamification: { ...buildDefaultGamification(false), streak: 9 }
      },
      {
        id: "student-demo-sofia",
        name: "Sofia Ramirez",
        grade: "11th",
        major: "Business",
        profileCompletion: 58,
        upcomingDeadlines: 6,
        lastMeeting: "Jun 4, 2026",
        nextMeeting: "Aug 12, 2026",
        applicationPhase: "researching",
        priorities: ["Build college list", "Summer program applications"],
        gamification: { ...buildDefaultGamification(false), streak: 1 }
      },
      {
        id: "student-demo-ethan",
        name: "Ethan Brooks",
        grade: "12th",
        major: "Biology",
        profileCompletion: 82,
        upcomingDeadlines: 3,
        lastMeeting: "Jun 6, 2026",
        nextMeeting: "Jul 15, 2026",
        applicationPhase: "submitted",
        priorities: ["Financial aid forms", "Scholarship follow-ups"],
        gamification: { ...buildDefaultGamification(false), streak: 12 }
      },
      {
        id: "student-demo-priya",
        name: "Priya Shah",
        grade: "11th",
        major: "Engineering",
        profileCompletion: 69,
        upcomingDeadlines: 4,
        lastMeeting: "Jun 8, 2026",
        nextMeeting: "Jul 3, 2026",
        applicationPhase: "researching",
        priorities: ["STEM summer programs", "Activity descriptions"],
        gamification: { ...buildDefaultGamification(false), streak: 6 }
      },
      {
        id: "student-demo-noah",
        name: "Noah Williams",
        grade: "12th",
        major: "Political Science",
        profileCompletion: 75,
        upcomingDeadlines: 2,
        lastMeeting: "Jun 10, 2026",
        nextMeeting: "Jun 30, 2026",
        applicationPhase: "deciding",
        priorities: ["Compare aid packages", "Campus visits"],
        gamification: { ...buildDefaultGamification(false), streak: 4 }
      },
      {
        id: "student-demo-lily",
        name: "Lily Nguyen",
        grade: "10th",
        major: "Psychology",
        profileCompletion: 52,
        upcomingDeadlines: 1,
        lastMeeting: "Jun 12, 2026",
        nextMeeting: "Aug 1, 2026",
        applicationPhase: "researching",
        priorities: ["Explore majors", "Build extracurricular depth"],
        gamification: { ...buildDefaultGamification(false), streak: 2 }
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
      [DEMO_SLUGS.jordan]: "Strong STEM narrative — encourage more specificity in activity descriptions. Watch essay tone in paragraph 2.",
      [DEMO_SLUGS.alex]: "Needs tighter scholarship timeline. Personal statement opening is solid but conclusion is vague."
    },
    conversations,
    messages: conversationsToInbox(conversations),
    summaryCards: {
      students: 24,
      meetingsThisWeek: 2,
      pendingRequests: 1,
      unreadMessages: 1,
      upcomingDeadlines: 6,
      upcomingBookings: 5
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
