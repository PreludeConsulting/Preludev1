export const REWARD_TASK_STATUS = {
  LOCKED: "locked",
  IN_PROGRESS: "in_progress",
  READY_TO_COMPLETE: "ready_to_complete",
  COMPLETED_BY_MENTOR: "completed_by_mentor",
  READY_TO_CLAIM: "ready_to_claim",
  CLAIMED: "claimed"
};

export const REWARD_TASK_OWNERSHIP = {
  MENTOR_CONTROLLED: "mentor_controlled",
  DASHBOARD_CONTROLLED: "dashboard_controlled"
};

export const REWARD_TASK_CATEGORY = {
  MOMENTUM: "momentum",
  ADMISSIONS: "admissions",
  SAT_ACT: "sat_act",
  ACADEMIC_TUTORING: "academic_tutoring"
};

export const MOMENTUM_TASK_DEFS = [
  {
    id: "welcome-onboarding-completed",
    title: "Welcome / Onboarding Completed",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 50,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 1,
    oneTime: true
  },
  {
    id: "momentum-3-day-login-streak",
    title: "3-Day Login Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 25,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 3
  },
  {
    id: "momentum-7-day-login-streak",
    title: "7-Day Momentum Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 50,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 7
  },
  {
    id: "mentor-network-3-day-streak",
    title: "3-Day Mentor Network Message Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 30,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 3
  },
  {
    id: "mentor-network-7-day-streak",
    title: "7-Day Mentor Network Message Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 60,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 7
  },
  {
    id: "mentor-meeting-completed",
    title: "Mentor Meeting Completed",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 50,
    ownership: REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED,
    targetCount: 1,
    mainMentorOnly: true
  }
];

/** Explicit admissions milestones with coin values (not a flat 25). */
export const ADMISSIONS_TASK_DEFS = [
  { id: "admissions-college-list-started", title: "College List Started", coins: 30 },
  { id: "admissions-college-list-finalized", title: "College List Finalized", coins: 50 },
  { id: "admissions-common-app-profile-completed", title: "Common App Profile Completed", coins: 40 },
  { id: "admissions-personal-statement-draft-submitted", title: "Personal Statement Draft Submitted", coins: 40 },
  { id: "admissions-personal-statement-finalized", title: "Personal Statement Finalized", coins: 60 },
  { id: "admissions-activities-list-completed", title: "Activities List Completed", coins: 40 },
  { id: "admissions-resume-completed", title: "Résumé Completed", coins: 40 },
  { id: "admissions-supplemental-essay-submitted", title: "Supplemental Essay Submitted", coins: 40 },
  { id: "admissions-supplemental-essay-finalized", title: "Supplemental Essay Finalized", coins: 60 },
  { id: "admissions-application-submitted", title: "Application Submitted", coins: 75 },
  { id: "admissions-scholarship-application-submitted", title: "Scholarship Application Submitted", coins: 50 }
].map((task) => ({
  ...task,
  category: REWARD_TASK_CATEGORY.ADMISSIONS,
  ownership: REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED,
  targetCount: 1,
  oneTime: true
}));

export const SAT_ACT_TASK_DEFS = [
  { id: "sat-act-diagnostic-test-completed", title: "Diagnostic Test Completed", coins: 50 },
  { id: "sat-act-practice-test-submitted", title: "Practice Test Submitted", coins: 50 },
  { id: "sat-act-reading-section-reviewed", title: "Reading Section Reviewed", coins: 40 },
  { id: "sat-act-math-section-reviewed", title: "Math Section Reviewed", coins: 40 },
  { id: "sat-act-english-section-reviewed", title: "English Section Reviewed", coins: 40 },
  { id: "sat-act-study-plan-completed", title: "SAT/ACT Study Plan Completed", coins: 40 },
  { id: "sat-act-score-milestone-reached", title: "Score Milestone Reached", coins: 60 }
].map((task) => ({
  ...task,
  category: REWARD_TASK_CATEGORY.SAT_ACT,
  ownership: REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED,
  targetCount: 1,
  oneTime: true
}));

export const ACADEMIC_TUTORING_TASK_DEFS = [
  { id: "academic-goal-created", title: "Academic Goal Created", coins: 30 },
  { id: "academic-tutoring-session-completed", title: "Tutoring Session Completed", coins: 50 },
  { id: "academic-major-assignment-completed", title: "Major Assignment Completed", coins: 40 },
  { id: "academic-test-prep-milestone-completed", title: "Test-Prep Milestone Completed", coins: 40 },
  { id: "academic-grade-improvement-milestone", title: "Grade-Improvement Milestone", coins: 60 }
].map((task) => ({
  ...task,
  category: REWARD_TASK_CATEGORY.ACADEMIC_TUTORING,
  ownership: REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED,
  targetCount: 1,
  oneTime: true
}));

/** @deprecated Prefer ADMISSIONS_TASK_DEFS — kept for title lookups. */
export const ADMISSIONS_TASK_POOL = ADMISSIONS_TASK_DEFS.map((task) => task.title);
/** @deprecated Prefer SAT_ACT_TASK_DEFS */
export const SAT_ACT_TASK_POOL = SAT_ACT_TASK_DEFS.map((task) => task.title);
/** @deprecated Prefer ACADEMIC_TUTORING_TASK_DEFS */
export const ACADEMIC_TUTORING_TASK_POOL = ACADEMIC_TUTORING_TASK_DEFS.map((task) => task.title);

export const REWARD_TASK_CATALOG = [
  ...MOMENTUM_TASK_DEFS,
  ...ADMISSIONS_TASK_DEFS,
  ...SAT_ACT_TASK_DEFS,
  ...ACADEMIC_TUTORING_TASK_DEFS
];

export const EARN_CATEGORY_ORDER = [
  REWARD_TASK_CATEGORY.MOMENTUM,
  REWARD_TASK_CATEGORY.ADMISSIONS,
  REWARD_TASK_CATEGORY.SAT_ACT,
  REWARD_TASK_CATEGORY.ACADEMIC_TUTORING
];

export const MILESTONE_CATEGORY_LABELS = {
  [REWARD_TASK_CATEGORY.MOMENTUM]: "Momentum",
  [REWARD_TASK_CATEGORY.ADMISSIONS]: "Admissions",
  [REWARD_TASK_CATEGORY.SAT_ACT]: "SAT & ACT",
  [REWARD_TASK_CATEGORY.ACADEMIC_TUTORING]: "Academic Tutoring"
};

export function getTaskDefinition(taskTemplateId) {
  return REWARD_TASK_CATALOG.find((task) => task.id === taskTemplateId) || null;
}

export function taskTemplateIdsForCategory(category) {
  return REWARD_TASK_CATALOG.filter((task) => task.category === category).map((task) => task.id);
}

/** Suggest one concrete action that can close `coinsNeeded` after multiplier. */
export function getRecommendedEarnAction(coinsNeeded = 0, multiplier = 1, options = {}) {
  const needed = Math.max(0, Number(coinsNeeded) || 0);
  if (!needed) return null;
  const eligible = REWARD_TASK_CATALOG.filter((task) => {
    if (task.category === REWARD_TASK_CATEGORY.SAT_ACT && !options.satActUnlocked) return false;
    if (task.category === REWARD_TASK_CATEGORY.ACADEMIC_TUTORING && !options.tutoringUnlocked) return false;
    return true;
  });
  const withFinal = eligible
    .map((task) => ({
      ...task,
      finalCoins: Math.round(task.coins * multiplier)
    }))
    .sort((a, b) => a.finalCoins - b.finalCoins);
  const enough = withFinal.find((task) => task.finalCoins >= needed);
  const pick = enough || withFinal[withFinal.length - 1];
  if (!pick) return null;
  if (pick.id === "mentor-meeting-completed") return "Complete one mentor meeting to get there";
  if (pick.id.includes("streak")) return `Keep your ${pick.title.toLowerCase()} going`;
  return `Complete “${pick.title}” to get there`;
}
