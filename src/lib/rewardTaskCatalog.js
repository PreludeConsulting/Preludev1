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
    id: "momentum-7-day-login-streak",
    title: "7-Day Momentum Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 30,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 7
  },
  {
    id: "mentor-meeting-completed",
    title: "Mentor Meeting Completed",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 25,
    ownership: REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED,
    targetCount: 1,
    mainMentorOnly: true
  },
  {
    id: "mentor-network-3-day-streak",
    title: "3-Day Mentor Network Message Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 20,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 3
  },
  {
    id: "mentor-network-7-day-streak",
    title: "7-Day Mentor Network Message Streak",
    category: REWARD_TASK_CATEGORY.MOMENTUM,
    coins: 45,
    ownership: REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED,
    targetCount: 7
  }
];

export const ADMISSIONS_TASK_POOL = [
  "College List Started",
  "College List Finalized",
  "Common App Profile Completed",
  "Personal Statement Draft Submitted",
  "Personal Statement Finalized",
  "Supplemental Essay Draft Submitted",
  "Activities List Completed",
  "Application Deadline Added",
  "Recommendation Request Planned",
  "Application Submitted"
];

export const SAT_ACT_TASK_POOL = [
  "Diagnostic Test Completed",
  "Practice Test Submitted",
  "Reading Section Reviewed",
  "Math Section Reviewed",
  "English Section Reviewed",
  "Science Section Reviewed",
  "Test Date Added",
  "Study Session Completed",
  "Weakness Review Completed"
];

export const ACADEMIC_TUTORING_TASK_POOL = [
  "Tutoring Session Completed",
  "Homework Review Completed",
  "Practice Assignment Submitted",
  "Topic Review Completed",
  "Quiz Review Completed",
  "Study Plan Checkpoint Completed",
  "Academic Progress Check Completed"
];

function slugifyTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPoolTask(poolName, category, title) {
  return {
    id: `${poolName}-${slugifyTitle(title)}`,
    title,
    category,
    coins: 25,
    ownership: REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED,
    targetCount: 1
  };
}

export const ADMISSIONS_TASK_DEFS = ADMISSIONS_TASK_POOL.map((title) =>
  buildPoolTask("admissions", REWARD_TASK_CATEGORY.ADMISSIONS, title)
);
export const SAT_ACT_TASK_DEFS = SAT_ACT_TASK_POOL.map((title) =>
  buildPoolTask("sat-act", REWARD_TASK_CATEGORY.SAT_ACT, title)
);
export const ACADEMIC_TUTORING_TASK_DEFS = ACADEMIC_TUTORING_TASK_POOL.map((title) =>
  buildPoolTask("academic-tutoring", REWARD_TASK_CATEGORY.ACADEMIC_TUTORING, title)
);

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

