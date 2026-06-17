/** Placeholder dashboard data — replace with API/DB records later. */

export const PLACEHOLDER_MENTOR = {
  id: "mentor-demo-1",
  name: "Maya Chen",
  university: "Stanford University",
  major: "Computer Science",
  graduationYear: "2027",
  bio: "Peer mentor focused on STEM applications, essay planning, and building a balanced college list.",
  expertise: ["Essay strategy", "STEM applications", "Financial aid basics", "Interview prep"],
  availability: "Weekday afternoons · 2 slots this week"
};

export const PLACEHOLDER_STUDENTS = [
  {
    id: "student-demo-1",
    name: "Jordan Lee",
    grade: "11th",
    major: "Computer Science",
    profileCompletion: 72,
    upcomingDeadlines: 3,
    lastMeeting: "Mar 12, 2026",
    nextMeeting: "Mar 18, 2026",
    priorities: ["Finalize college list", "Draft personal statement"]
  },
  {
    id: "student-demo-2",
    name: "Avery Kim",
    grade: "12th",
    major: "Economics",
    profileCompletion: 88,
    upcomingDeadlines: 1,
    lastMeeting: "Mar 8, 2026",
    nextMeeting: "Mar 20, 2026",
    priorities: ["Scholarship essays", "FAFSA follow-up"]
  }
];

export const PLACEHOLDER_EVENTS = [
  {
    id: "evt-1",
    title: "Mentor check-in — Essay strategy",
    category: "mentor_meeting",
    start: "2026-03-18T20:00:00.000Z",
    end: "2026-03-18T20:45:00.000Z",
    studentId: "student-demo-1",
    mentorId: "mentor-demo-1",
    shared: true,
    zoomJoinUrl: "https://zoom.us/j/placeholder-student-join"
  },
  {
    id: "evt-2",
    title: "UC application deadline",
    category: "application_deadline",
    start: "2026-11-30T08:00:00.000Z",
    end: "2026-11-30T08:00:00.000Z",
    shared: true
  },
  {
    id: "evt-3",
    title: "Personal statement draft due",
    category: "essay_deadline",
    start: "2026-04-05T04:00:00.000Z",
    end: "2026-04-05T04:00:00.000Z",
    shared: true
  },
  {
    id: "evt-4",
    title: "Mentor planning block",
    category: "mentor_private",
    start: "2026-03-19T14:00:00.000Z",
    end: "2026-03-19T15:00:00.000Z",
    shared: false,
    mentorOnly: true
  }
];

export const PLACEHOLDER_TASKS = [
  { id: "t1", title: "Review reach school essay prompts", priority: "high", done: false },
  { id: "t2", title: "Update extracurricular descriptions", priority: "medium", done: false },
  { id: "t3", title: "Schedule mock interview with mentor", priority: "medium", done: true }
];

export const PLACEHOLDER_ESSAYS = [
  { id: "e1", title: "Personal Statement", words: 412, status: "Draft", updatedAt: "Mar 10" },
  { id: "e2", title: "Stanford Supplement", words: 198, status: "In progress", updatedAt: "Mar 8" }
];

export const PLACEHOLDER_COLLEGES = [
  { id: "c1", name: "Stanford University", tier: "reach", status: "Researching", deadline: "Nov 30" },
  { id: "c2", name: "Georgia Tech", tier: "target", status: "Applying", deadline: "Jan 4" },
  { id: "c3", name: "UCLA", tier: "likely", status: "Researching", deadline: "Nov 30" }
];

export const PLACEHOLDER_MESSAGES = [
  {
    id: "m1",
    from: "Maya Chen",
    preview: "Great progress on your essay outline — let's review paragraph 2 on Thursday.",
    time: "2h ago",
    unread: true
  }
];

export const STUDENT_AI_PROMPTS = [
  "What deadlines should I focus on this week?",
  "Help me improve my college list.",
  "What should I discuss with my mentor?",
  "Review my essay outline.",
  "Show my incomplete tasks."
];

export const EVENT_CATEGORY_LABELS = {
  mentor_meeting: "Mentor Meeting",
  application_deadline: "Application Deadline",
  essay_deadline: "Essay Deadline",
  scholarship_deadline: "Scholarship Deadline",
  personal_task: "Personal Task",
  mentor_availability: "Mentor Availability",
  mentor_private: "Mentor-Only Private Event",
  pending_request: "Pending Request"
};

export const EVENT_CATEGORY_COLORS = {
  mentor_meeting: "#7c6cff",
  application_deadline: "#232730",
  essay_deadline: "#2563eb",
  scholarship_deadline: "#9a6700",
  personal_task: "#9b8cff",
  mentor_availability: "#5b4fd6",
  mentor_private: "#94a3b8",
  pending_request: "#f97316"
};
