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
  if (grade >= 9 && grade <= 11) return DASHBOARD_PHASE.PREPARATION;
  return DASHBOARD_PHASE.APPLICATION;
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

export const DEFAULT_OPPORTUNITIES = [
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
];

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
