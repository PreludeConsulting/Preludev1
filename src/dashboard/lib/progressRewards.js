/** Prelude Coins — milestone-based rewards stored in the student's Piggy Bank. */

export const TEST_PREP_OPTIONS = [
  "SAT Math",
  "SAT Reading/Writing",
  "ACT Math",
  "ACT English",
  "ACT Reading",
  "ACT Science"
];

export const REWARD_CATALOG = [
  {
    id: "essay-review-session",
    title: "Essay Review Session",
    headline: "FREE Essay Review Session",
    subtitle: "2 Mentor Review",
    category: "Essays",
    coins: 300,
    estimatedValue: 75,
    description: "Two mentors review the student's essay and leave detailed feedback.",
    featured: true,
    iconTone: "mint"
  },
  {
    id: "test-prep-help",
    title: "Test Prep Help Session",
    headline: "FREE Test Prep Help Session",
    subtitle: "SAT / ACT Help",
    category: "Test Prep",
    coins: 250,
    estimatedValue: 50,
    description: "Choose SAT Math, SAT Reading/Writing, ACT Math, ACT English, ACT Reading, or ACT Science after redeeming.",
    iconTone: "sky",
    requiresSelection: true
  },
  {
    id: "college-list-review",
    title: "College List Review",
    headline: "FREE College List Review",
    subtitle: "Reach / Target / Safety Review",
    category: "Admissions",
    coins: 220,
    estimatedValue: 45,
    description: "A mentor reviews the student's college list and helps organize reach, target, and safety schools.",
    iconTone: "blue"
  },
  {
    id: "activities-list-review",
    title: "Activities List Review",
    headline: "FREE Activities List Review",
    subtitle: "Extracurricular Feedback",
    category: "Admissions",
    coins: 200,
    estimatedValue: 40,
    description: "A mentor reviews the student's activity descriptions and gives improvement suggestions.",
    iconTone: "amber"
  },
  {
    id: "application-strategy-call",
    title: "Application Strategy Call",
    headline: "FREE Application Strategy Call",
    subtitle: "Planning Session",
    category: "Admissions",
    coins: 200,
    estimatedValue: 40,
    description: "A mentor helps plan deadlines, essays, school priorities, and next steps.",
    iconTone: "rose"
  },
  {
    id: "major-career-fit",
    title: "Major / Career Fit Session",
    headline: "FREE Major / Career Fit Session",
    subtitle: "Major Exploration",
    category: "Planning",
    coins: 180,
    estimatedValue: 35,
    description: "A mentor helps the student explore possible majors, career paths, and college fit.",
    iconTone: "indigo"
  },
  {
    id: "mock-interview",
    title: "Mock Interview Session",
    headline: "FREE Mock Interview Session",
    subtitle: "Interview Practice",
    category: "Admissions",
    coins: 180,
    estimatedValue: 35,
    description: "A mentor runs a college-style mock interview and gives feedback.",
    iconTone: "purple"
  },
  {
    id: "scholarship-search",
    title: "Scholarship Search Session",
    headline: "FREE Scholarship Search Session",
    subtitle: "Scholarship Planning",
    category: "Planning",
    coins: 150,
    estimatedValue: 30,
    description: "A mentor helps the student find scholarships and create a quick application plan.",
    iconTone: "peach"
  }
];

export const STATUS_TIERS = [
  {
    id: "starter-saver",
    name: "Starter Saver",
    min: 0,
    max: 199,
    benefits: ["Earn coins on every milestone", "Access to the rewards store"]
  },
  {
    id: "goal-setter",
    name: "Goal Setter",
    min: 200,
    max: 499,
    benefits: ["Bonus coin multipliers on momentum streaks", "Early access to new rewards"]
  },
  {
    id: "scholar-saver",
    name: "Scholar Saver",
    min: 500,
    max: 999,
    benefits: ["Priority reward scheduling", "Exclusive essay review slots"]
  },
  {
    id: "prelude-elite",
    name: "Prelude Elite",
    min: 1000,
    max: Infinity,
    benefits: ["Maximum coin earning potential", "VIP mentor office hours access"]
  }
];

export const EARN_CATEGORY_ORDER = ["momentum", "admissions", "sat_act", "academic_tutoring"];

export const MILESTONE_CATEGORY_LABELS = {
  momentum: "Momentum",
  admissions: "Admissions",
  sat_act: "SAT & ACT",
  academic_tutoring: "Academic Tutoring"
};

const ALL_GRADES = [9, 10, 11, 12];

export const MILESTONE_CATALOG = [
  { id: "first-mentor-meeting", title: "First Mentor Meeting", category: "admissions", coins: 30, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "college-list-started", title: "College List Started", category: "admissions", coins: 25, grades: [10, 11, 12], priority: [11, 12] },
  { id: "college-list-finalized", title: "College List Finalized", category: "admissions", coins: 40, grades: [11, 12], priority: [11, 12] },
  { id: "first-college-applied", title: "First College Applied To", category: "admissions", coins: 50, grades: [12], priority: [12] },
  { id: "first-essay-submitted", title: "First Essay Submitted", category: "admissions", coins: 35, grades: [11, 12], priority: [11, 12] },
  { id: "application-submitted-early", title: "Application Submitted Early", category: "admissions", coins: 45, grades: [12], priority: [12] },
  { id: "interview-completed", title: "Interview Completed", category: "admissions", coins: 30, grades: [11, 12], priority: [12] },
  { id: "fafsa-completed", title: "FAFSA Completed", category: "admissions", coins: 35, grades: [12], priority: [12] },
  { id: "acceptance-received", title: "Acceptance Received", category: "admissions", coins: 60, grades: [12], priority: [12] },
  { id: "momentum-3-day", title: "3-Day Momentum Streak", category: "momentum", coins: 15, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "momentum-7-day", title: "7-Day Momentum Streak", category: "momentum", coins: 30, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "momentum-14-day", title: "14-Day Momentum Streak", category: "momentum", coins: 50, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "weekly-check-in", title: "Weekly Check-In Completed", category: "momentum", coins: 20, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "mentor-meeting-completed", title: "Mentor Meeting Completed", category: "momentum", coins: 25, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "roadmap-task-completed", title: "Roadmap Task Completed", category: "momentum", coins: 20, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "diagnostic-test", title: "Diagnostic Test Completed", category: "sat_act", coins: 25, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "first-practice-review", title: "First Practice Test Reviewed", category: "sat_act", coins: 30, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "study-roadmap-created", title: "Study Roadmap Created", category: "sat_act", coins: 25, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "sat-prep-7-day", title: "7-Day SAT Prep Streak", category: "sat_act", coins: 35, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "score-goal-set", title: "Score Goal Set", category: "sat_act", coins: 20, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "testing-strategy-session", title: "Testing Strategy Session Completed", category: "sat_act", coins: 40, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "first-tutoring-session", title: "First Tutoring Session Completed", category: "academic_tutoring", coins: 30, grades: ALL_GRADES, priority: ALL_GRADES, requiresService: "academicTutoring" },
  { id: "homework-review", title: "Homework Review Completed", category: "academic_tutoring", coins: 20, grades: ALL_GRADES, priority: ALL_GRADES, requiresService: "academicTutoring" },
  { id: "test-review-completed", title: "Test Review Completed", category: "academic_tutoring", coins: 25, grades: ALL_GRADES, priority: ALL_GRADES, requiresService: "academicTutoring" },
  { id: "course-goal-set", title: "Course Goal Set", category: "academic_tutoring", coins: 20, grades: ALL_GRADES, priority: ALL_GRADES, requiresService: "academicTutoring" },
  { id: "study-streak-7-day", title: "7-Day Study Streak", category: "academic_tutoring", coins: 35, grades: ALL_GRADES, priority: ALL_GRADES, requiresService: "academicTutoring" },
  { id: "academic-improvement", title: "Academic Improvement Logged", category: "academic_tutoring", coins: 30, grades: ALL_GRADES, priority: ALL_GRADES, requiresService: "academicTutoring" }
];

export const FEATURED_REWARD_ID = "essay-review-session";

export function parseGradeLevel(gradeLabel = "") {
  const match = String(gradeLabel).match(/(\d+)/);
  return match ? Number(match[1]) : 11;
}

export function getActiveServices(profile = {}, overrides = {}) {
  return {
    admissionsMentorship: overrides.admissionsMentorship ?? true,
    satActPrep: overrides.satActPrep ?? profile.satActPrep ?? false,
    academicTutoring: overrides.academicTutoring ?? profile.academicTutoring ?? false
  };
}

function serviceSatisfied(requiresService, services) {
  if (!requiresService) return true;
  return Boolean(services[requiresService]);
}

export function filterMilestonesForStudent({ grade, services, catalog = MILESTONE_CATALOG }) {
  return catalog
    .filter((m) => m.grades.includes(grade))
    .filter((m) => serviceSatisfied(m.requiresService, services))
    .sort((a, b) => {
      const aPri = a.priority.includes(grade) ? 0 : 1;
      const bPri = b.priority.includes(grade) ? 0 : 1;
      if (aPri !== bPri) return aPri - bPri;
      return a.title.localeCompare(b.title);
    });
}

export function resolveMilestoneStatus(milestoneId, state = {}) {
  if (state.completed?.includes(milestoneId)) return "completed";
  if (state.inProgress?.includes(milestoneId)) return "in_progress";
  return "locked";
}

export function enrichMilestones(milestones, state) {
  return milestones.map((m) => {
    const status = resolveMilestoneStatus(m.id, state);
    return {
      ...m,
      status,
      progress: status === "in_progress"
        ? (state.inProgressProgress?.[m.id] ?? 65)
        : status === "completed"
          ? 100
          : 0
    };
  });
}

export function getStatusTier(coins) {
  return STATUS_TIERS.find((t) => coins >= t.min && coins <= t.max) || STATUS_TIERS[0];
}

export function getNextStatusTier(coins) {
  const currentIndex = STATUS_TIERS.findIndex((t) => coins >= t.min && coins <= t.max);
  return currentIndex < STATUS_TIERS.length - 1 ? STATUS_TIERS[currentIndex + 1] : null;
}

export function getTierProgress(coins) {
  const tier = getStatusTier(coins);
  const next = getNextStatusTier(coins);
  if (!next) return 100;
  const span = next.min - tier.min;
  const earned = coins - tier.min;
  return Math.min(100, Math.round((earned / span) * 100));
}

export function getFeaturedReward(catalog = REWARD_CATALOG) {
  return catalog.find((r) => r.featured) || catalog[0];
}

export function getNextAffordableReward(coins, redeemed = []) {
  return REWARD_CATALOG.find((r) => !redeemed.includes(r.id) && coins < r.coins) || REWARD_CATALOG[0];
}

export function getCoinsToNextReward(coins, reward) {
  if (!reward) return 0;
  return Math.max(0, reward.coins - coins);
}

export function getRewardProgressPct(coins, rewardCoins) {
  if (!rewardCoins) return 0;
  return Math.min(100, Math.round((coins / rewardCoins) * 100));
}

export function enrichReward(reward, coins, redeemed = []) {
  const isRedeemed = redeemed.includes(reward.id);
  return {
    ...reward,
    redeemed: isRedeemed,
    canRedeem: coins >= reward.coins && !isRedeemed,
    coinsAway: Math.max(0, reward.coins - coins),
    progressPct: getRewardProgressPct(coins, reward.coins)
  };
}

/** Locked rewards nearest to unlock, sorted by coins away. */
export function getClosestRewards(coins, redeemed = [], catalog = REWARD_CATALOG, limit = 3) {
  const saving = catalog
    .filter((r) => !redeemed.includes(r.id) && coins < r.coins)
    .map((r) => ({
      ...r,
      coinsAway: r.coins - coins,
      progressPct: getRewardProgressPct(coins, r.coins),
      canRedeem: false
    }))
    .sort((a, b) => a.coinsAway - b.coinsAway);

  if (saving.length >= limit) return saving.slice(0, limit);

  const ready = catalog
    .filter((r) => !redeemed.includes(r.id) && coins >= r.coins)
    .map((r) => ({
      ...r,
      coinsAway: 0,
      progressPct: 100,
      canRedeem: true
    }))
    .sort((a, b) => b.coins - a.coins);

  return [...saving, ...ready].slice(0, limit);
}

export function countMilestonesToReward(coins, milestones, targetReward) {
  if (!targetReward) return 0;
  const needed = Math.max(0, targetReward.coins - coins);
  if (needed === 0) return 0;

  const pending = milestones
    .filter((m) => m.status !== "completed")
    .sort((a, b) => a.coins - b.coins);

  let accumulated = 0;
  let count = 0;
  for (const m of pending) {
    accumulated += m.coins;
    count += 1;
    if (accumulated >= needed) break;
  }
  return count;
}

export function buildDefaultProgressRewards(isJordan) {
  if (!isJordan) {
    return {
      coins: 85,
      completed: ["first-mentor-meeting", "momentum-3-day"],
      inProgress: ["college-list-started"],
      inProgressProgress: { "college-list-started": 40 },
      redeemed: [],
      redemptionHistory: []
    };
  }

  return {
    coins: 240,
    completed: [
      "first-mentor-meeting",
      "college-list-started",
      "momentum-3-day",
      "diagnostic-test",
      "first-tutoring-session",
      "weekly-check-in"
    ],
    inProgress: ["momentum-7-day", "study-roadmap-created"],
    inProgressProgress: {
      "momentum-7-day": 72,
      "study-roadmap-created": 55
    },
    redeemed: [],
    redemptionHistory: []
  };
}

export function buildJordanDemoServices() {
  return {
    admissionsMentorship: true,
    satActPrep: true,
    academicTutoring: true
  };
}

export const MENTOR_MOMENTUM_MODULES = {
  messaging: {
    emoji: "🔥",
    title: "7 Day Messaging Streak",
    statLabel: "7 Days",
    current: 7,
    goal: 14,
    weekDays: [
      { label: "M", status: "done" },
      { label: "T", status: "done" },
      { label: "W", status: "done" },
      { label: "T", status: "done" },
      { label: "F", status: "done" },
      { label: "S", status: "done" },
      { label: "S", status: "pending" }
    ],
    reward: 50
  },
  meetings: {
    emoji: "🤝",
    title: "Mentor Meetings",
    current: 4,
    goal: 5,
    reward: 50,
    hint: "1 meeting away"
  },
  checkIns: {
    emoji: "📅",
    title: "Weekly Check-Ins",
    current: 3,
    goal: 4,
    reward: 25,
    hint: "1 check-in away"
  },
  nextReward: {
    headline: "FREE Essay Review Session",
    coinsAway: 60,
    progressPct: 80
  }
};

/** @deprecated replaced by MENTOR_MOMENTUM_MODULES */
export const MENTOR_MOMENTUM_HERO = {
  current: 7,
  goal: 14,
  streakLabel: "Mentor messaging streak",
  rewardCoins: 50,
  rewardHint: "Keep your streak alive to earn +50 Coins.",
  weekDays: MENTOR_MOMENTUM_MODULES.messaging.weekDays
};

/** @deprecated replaced by MENTOR_MOMENTUM_MODULES */
export const MENTOR_MOMENTUM_SECONDARY = [];

/** @deprecated legacy list format */
export const MENTOR_MOMENTUM = [
  { id: "messaging", emoji: "🔥", label: "7-Day Mentor Messaging Streak", days: 7, completed: 6, reward: 50 },
  { id: "check-in", emoji: "📅", label: "3 Consecutive Weekly Check-ins", days: 3, completed: 3, reward: 20 },
  { id: "meetings", emoji: "🤝", label: "4 Mentor Meetings Completed", days: 4, completed: 4, reward: 25 },
  { id: "roadmap", emoji: "🎯", label: "5 Roadmap Tasks Completed", days: 5, completed: 5, reward: 30 }
];

/** @deprecated use MENTOR_MOMENTUM */
export const ENGAGEMENT_STREAKS = MENTOR_MOMENTUM;

export const GRID_REWARD_IDS = [
  "test-prep-help",
  "college-list-review",
  "activities-list-review",
  "application-strategy-call",
  "major-career-fit",
  "mock-interview"
];

export const DAILY_MOMENTUM_STREAK = {
  title: "Daily Momentum Streak",
  description: "Message your mentor daily to keep your streak alive.",
  weekDays: [
    { label: "M", status: "done" },
    { label: "T", status: "done" },
    { label: "W", status: "done" },
    { label: "T", status: "done" },
    { label: "F", status: "done" },
    { label: "S", status: "pending" },
    { label: "S", status: "pending" }
  ],
  streakDays: 7,
  rewardCoins: 15
};

export const CHALLENGE_CARDS = [
  {
    id: "mentor-meetings",
    title: "Complete 3 Mentor Meetings",
    coins: 100,
    total: 3,
    completed: 2,
    hint: "Only 1 more meeting!",
    status: "active",
    type: "circles"
  },
  {
    id: "first-essay",
    title: "Submit Your First Essay",
    coins: 75,
    total: 1,
    completed: 0,
    hint: "0 / 1",
    status: "active",
    type: "chevron"
  },
  {
    id: "study-streak",
    title: "7-Day Study Streak",
    coins: 50,
    total: 7,
    completed: 7,
    hint: "Completed!",
    status: "completed",
    type: "checks"
  },
  {
    id: "workshop",
    title: "Attend a Workshop",
    coins: 30,
    total: 1,
    completed: 0,
    hint: "0 / 1",
    status: "active",
    type: "chevron"
  }
];

export const HOW_IT_WORKS_STEPS = [
  { id: "milestones", label: "Complete Milestones", icon: "target" },
  { id: "earn", label: "Earn Prelude Coins", icon: "coins" },
  { id: "redeem", label: "Redeem Free Rewards", icon: "gift" }
];

export const RECENT_COIN_ACTIVITY = [
  { id: "a1", coins: 10, label: "Replied to mentor message" },
  { id: "a2", coins: 25, label: "Mentor meeting completed" },
  { id: "a3", coins: 50, label: "7-Day mentor streak" },
  { id: "a4", coins: 75, label: "Essay submitted" },
  { id: "a5", coins: 20, label: "Weekly check-in completed" }
];

export function buildSidebarProgress(isJordan, coins, completedCount) {
  if (!isJordan) {
    return {
      milestonesCompleted: completedCount,
      currentStreak: 3,
      meetingsCompleted: 1,
      coinsEarned: coins
    };
  }
  return {
    milestonesCompleted: 12,
    currentStreak: 7,
    meetingsCompleted: 4,
    coinsEarned: coins
  };
}

/** Migrate legacy `tokens` field from localStorage. */
export function normalizeRewardsState(raw = {}) {
  return {
    coins: raw.coins ?? raw.tokens ?? 0,
    completed: raw.completed ?? [],
    inProgress: raw.inProgress ?? [],
    inProgressProgress: raw.inProgressProgress ?? {},
    redeemed: raw.redeemed ?? [],
    redemptionHistory: raw.redemptionHistory ?? []
  };
}
