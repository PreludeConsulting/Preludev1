/** Grade-based student dashboard phase configuration. */

export const DASHBOARD_PHASE = {
  PREPARATION: "preparation",
  APPLICATION: "application"
};

export function parseGradeNumber(profile) {
  if (!profile) return null;

  const gradeText = String(profile.grade || "").toLowerCase();
  const match = gradeText.match(/(\d{1,2})/);
  if (match) return Number(match[1]);

  if (profile.graduationYear) {
    const currentYear = new Date().getFullYear();
    const inferred = 12 - (profile.graduationYear - currentYear);
    if (inferred >= 9 && inferred <= 12) return inferred;
  }

  return null;
}

export function getDashboardPhase(profile) {
  const grade = parseGradeNumber(profile);
  if (grade === 12) return DASHBOARD_PHASE.APPLICATION;
  return DASHBOARD_PHASE.PREPARATION;
}

export function getPhaseHeaderLabel(profile) {
  const grade = parseGradeNumber(profile);
  if (grade >= 9 && grade <= 11) {
    return `Grade ${grade} • College Preparation Phase`;
  }
  if (grade === 12) {
    return "Grade 12 • Application Phase";
  }
  return "College Preparation Phase";
}

export const DEFAULT_ACADEMIC_PROGRESS = {
  gpaStrength: 96,
  courseRigor: 89,
  activities: 78,
  leadership: 72
};

export const DEFAULT_STUDENT_PROFILE_STATS = {
  gpa: "3.85",
  apHonors: 4,
  leadershipRoles: 1,
  volunteerHours: 48
};

export const DEFAULT_COLLEGE_JOURNEY = [
  { id: "j1", label: "First extracurricular joined", done: true },
  { id: "j2", label: "First leadership role", done: true },
  { id: "j3", label: "First AP course", done: false },
  { id: "j4", label: "SAT completed", done: false },
  { id: "j5", label: "College visit completed", done: false },
  { id: "j6", label: "College applications submitted", done: false }
];

export const DEFAULT_ESSAY_TRACKER = [
  { id: "et-1", title: "Personal Statement", status: "In Progress" },
  { id: "et-2", title: "Common App Essay", status: "Not Started" },
  { id: "et-3", title: "Supplement Essays", status: "Not Started" }
];

export const DEFAULT_FINANCIAL_AID_TRACKER = [
  { id: "fa-1", label: "FAFSA", status: "In Progress", value: 60 },
  { id: "fa-2", label: "CSS Profile", status: "Not Started", value: 0 },
  { id: "fa-3", label: "Scholarships Found", status: "In Progress", value: 8 },
  { id: "fa-4", label: "Scholarships Submitted", status: "In Progress", value: 3 }
];

export const DEFAULT_STUDENT_PROFILE = {
  grade: "11th grade",
  graduationYear: 2027,
  gpa: 3.86,
  gpaScale: "/4.00",
  weightedGpa: 4.21,
  majors: ["Computer Science", "Data Science"],
  colleges: ["Georgia Tech", "UCLA", "University of Michigan"],
  profileCompletion: 78
};

/** Blank profile for newly registered students (not demo accounts). */
export const EMPTY_STUDENT_PROFILE = {
  profileCompletion: 0
};

function dayOffset(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function eventEnd(start, minutes = 60) {
  return new Date(start.getTime() + minutes * 60 * 1000);
}

/** Seed calendar + upcoming events when a student has no synced events yet. */
export function buildDefaultStudentEvents() {
  const mentorToday = dayOffset(0, 16, 0);
  const calcToday = dayOffset(0, 18, 30);
  const roboticsTomorrow = dayOffset(1, 15, 30);
  const scholarshipTomorrow = dayOffset(1, 9, 0);

  return [
    {
      id: "default-upcoming-mentor",
      title: "Mentor Meeting",
      category: "mentor_meeting",
      start: mentorToday.toISOString(),
      end: eventEnd(mentorToday, 60).toISOString(),
      shared: true
    },
    {
      id: "default-upcoming-calc",
      title: "AP Calculus Review",
      category: "personal_task",
      start: calcToday.toISOString(),
      end: eventEnd(calcToday, 90).toISOString(),
      shared: true
    },
    {
      id: "default-upcoming-robotics",
      title: "Robotics Club Meeting",
      category: "personal_task",
      start: roboticsTomorrow.toISOString(),
      end: eventEnd(roboticsTomorrow, 90).toISOString(),
      shared: true
    },
    {
      id: "default-upcoming-scholarship",
      title: "Scholarship Deadline",
      category: "scholarship_deadline",
      start: scholarshipTomorrow.toISOString(),
      end: scholarshipTomorrow.toISOString(),
      shared: true
    },
    {
      id: "default-prep-ap",
      title: "AP Calculus BC Exam",
      category: "personal_task",
      start: dayOffset(14).toISOString(),
      end: dayOffset(14).toISOString(),
      shared: true
    },
    {
      id: "default-prep-sat",
      title: "SAT Test Date",
      category: "personal_task",
      start: dayOffset(10).toISOString(),
      end: dayOffset(10).toISOString(),
      shared: true
    },
    {
      id: "default-prep-club",
      title: "Robotics Club Meeting",
      category: "personal_task",
      start: dayOffset(5, 15, 30).toISOString(),
      end: eventEnd(dayOffset(5, 15, 30), 90).toISOString(),
      shared: true
    },
    {
      id: "default-prep-visit",
      title: "Campus Visit",
      category: "personal_task",
      start: dayOffset(16).toISOString(),
      end: dayOffset(16).toISOString(),
      shared: true
    }
  ];
}

export const PREP_AI_SUGGESTIONS = [
  "Consider taking AP Statistics next year.",
  "Join a leadership role within FBLA.",
  "Research engineering summer programs.",
  "Add one community service activity this semester.",
  "Build a stronger spike in computer science."
];

export const APPLICATION_AI_SUGGESTIONS = [
  "Finish your Georgia Tech supplement.",
  "Submit FAFSA before the priority deadline.",
  "Complete your activities section.",
  "Review your essay before your mentor meeting."
];
