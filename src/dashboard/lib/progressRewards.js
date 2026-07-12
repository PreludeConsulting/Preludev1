/** Prelude Coins — milestone-based rewards stored in the student's Piggy Bank. */

export const REWARD_TIER_IDS = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary"
};

export const REWARD_TIERS = {
  common: {
    id: "common",
    label: "COMMON",
    accentColor: "#94A3B8",
    backgroundColor: "#F8FAFC",
    badgeClass: "dash-reward-tier--common",
    animationClass: "dash-reward-celebrate--common",
    celebrationType: "sparkle"
  },
  uncommon: {
    id: "uncommon",
    label: "UNCOMMON",
    accentColor: "#14B8A6",
    backgroundColor: "#ECFDF5",
    badgeClass: "dash-reward-tier--uncommon",
    animationClass: "dash-reward-celebrate--uncommon",
    celebrationType: "glow-pulse"
  },
  rare: {
    id: "rare",
    label: "RARE",
    accentColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
    badgeClass: "dash-reward-tier--rare",
    animationClass: "dash-reward-celebrate--rare",
    celebrationType: "shimmer"
  },
  epic: {
    id: "epic",
    label: "EPIC",
    accentColor: "#8B5CF6",
    backgroundColor: "#F5F3FF",
    badgeClass: "dash-reward-tier--epic",
    animationClass: "dash-reward-celebrate--epic",
    celebrationType: "glow-burst"
  },
  legendary: {
    id: "legendary",
    label: "LEGENDARY",
    accentColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
    badgeClass: "dash-reward-tier--legendary",
    animationClass: "dash-reward-celebrate--legendary",
    celebrationType: "coin-shower"
  }
};

/** Alias for tier styling config used by reward cards and celebrations. */
export const rewardTierConfig = REWARD_TIERS;

export const STATUS_MILESTONES = [
  { id: "starter", name: "Starter", coinsRequired: 0, multiplier: 1.0, icon: "trophy" },
  { id: "goal-setter", name: "Goal Setter", coinsRequired: 150, multiplier: 1.1, icon: "target" },
  { id: "momentum-builder", name: "Momentum Builder", coinsRequired: 350, multiplier: 1.15, icon: "zap" },
  { id: "application-pro", name: "Application Pro", coinsRequired: 600, multiplier: 1.2, icon: "file" },
  { id: "ivy-climber", name: "Ivy Climber", coinsRequired: 900, multiplier: 1.25, icon: "mountain" },
  { id: "prelude-legend", name: "Prelude Legend", coinsRequired: 1300, multiplier: 1.3, icon: "crown" }
];

/** Cap for one-time founding-member welcome grants. */
export const FOUNDING_MEMBER_BONUS_CAP = 17;
export const WELCOME_BONUS_COINS = 50;
export const FOUNDING_MEMBER_BONUS_COINS = 100;

/**
 * Status tiers use lifetime earned coins (never reduced by redemptions).
 * Available/spendable balance is separate (`coin_balance` / availableCoins).
 */
export function getCurrentStatusMilestone(lifetimeCoins = 0) {
  let current = STATUS_MILESTONES[0];
  for (const milestone of STATUS_MILESTONES) {
    if (lifetimeCoins >= milestone.coinsRequired) current = milestone;
    else break;
  }
  return current;
}

export function getNextStatusMilestone(lifetimeCoins = 0) {
  return STATUS_MILESTONES.find((m) => lifetimeCoins < m.coinsRequired) || null;
}

export function getCoinMultiplier(lifetimeCoins = 0) {
  return getCurrentStatusMilestone(lifetimeCoins).multiplier;
}

export function getCoinsToNextMultiplier(lifetimeCoins = 0) {
  const next = getNextStatusMilestone(lifetimeCoins);
  if (!next) return 0;
  return Math.max(0, next.coinsRequired - lifetimeCoins);
}

export function getStatusBarProgressPct(lifetimeCoins = 0) {
  const max = STATUS_MILESTONES[STATUS_MILESTONES.length - 1].coinsRequired;
  if (!max) return 0;
  return Math.min(100, Math.round((lifetimeCoins / max) * 100));
}

export function getMilestoneNodeStatus(lifetimeCoins, milestone) {
  if (lifetimeCoins >= milestone.coinsRequired) return "completed";
  const next = getNextStatusMilestone(lifetimeCoins);
  if (next?.id === milestone.id) return "current";
  return "locked";
}

export function applyCoinMultiplier(baseCoins, multiplier) {
  return Math.round(Number(baseCoins || 0) * Number(multiplier || 1));
}

export function formatCoinsAwayLabel(coinsAway) {
  const n = Math.max(0, Number(coinsAway) || 0);
  if (!n) return "Ready to redeem";
  if (n <= 60) return `${n} more coins needed`;
  return `${n} more coins needed`;
}

export function formatStatusProgressCopy(lifetimeCoins = 0) {
  const next = getNextStatusMilestone(lifetimeCoins);
  if (!next) {
    return {
      title: "You've unlocked every status milestone.",
      subtitle: "Enjoy your maximum 1.3x coin multiplier."
    };
  }
  const needed = Math.max(0, next.coinsRequired - lifetimeCoins);
  return {
    title: `${needed.toLocaleString()} more coins to unlock ${next.name}`,
    subtitle: `Unlock a ${next.multiplier === 1.15 || next.multiplier === 1.25 ? next.multiplier : next.multiplier.toFixed(1)}x coin multiplier`,
    coinsNeeded: needed,
    next
  };
}

/** Cheapest unredeemed reward cost for piggy-bank short-term goal. */
export function getCheapestRewardTarget(availableCoins = 0, redeemed = [], catalog = REWARD_CATALOG) {
  const open = catalog.filter((reward) => !redeemed.includes(reward.id));
  if (!open.length) return null;
  const sorted = [...open].sort((a, b) => a.coins - b.coins);
  const cheapest = sorted[0];
  const canRedeem = availableCoins >= cheapest.coins;
  return {
    reward: cheapest,
    goalCoins: cheapest.coins,
    coinsAway: Math.max(0, cheapest.coins - availableCoins),
    canRedeem,
    label: canRedeem
      ? "You can redeem a reward now"
      : `${Math.max(0, cheapest.coins - availableCoins)} coins until your first reward`
  };
}

/** Default tier for catalog items without an explicit tier. */
export function inferTierFromCoins(coins) {
  if (coins >= 200) return REWARD_TIER_IDS.EPIC;
  if (coins >= 120) return REWARD_TIER_IDS.RARE;
  return REWARD_TIER_IDS.COMMON;
}

export function getRewardTierConfig(tierId) {
  return REWARD_TIERS[tierId] || REWARD_TIERS.common;
}

export function resolveRewardTier(reward) {
  const tierId = reward?.tier || inferTierFromCoins(reward?.coins ?? 0);
  return { tierId, tierConfig: getRewardTierConfig(tierId) };
}

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
    id: "priority-office-hours",
    title: "Priority Office Hours Pass",
    headline: "FREE Priority Office Hours Pass",
    subtitle: "Skip-the-Line Access",
    category: "Mentorship",
    shopGroup: "quick",
    coins: 60,
    estimatedValue: 35,
    description: "Get priority access to mentor office hours for quick questions and feedback.",
    iconTone: "purple",
    tier: "common"
  },
  {
    id: "quick-essay-feedback",
    title: "Quick Essay Feedback",
    headline: "FREE Quick Essay Feedback",
    subtitle: "Fast Written Notes",
    category: "Essays",
    shopGroup: "quick",
    coins: 90,
    estimatedValue: 45,
    description: "Get a focused round of written essay feedback from a Prelude mentor.",
    iconTone: "mint",
    tier: "common"
  },
  {
    id: "short-application-review",
    title: "Short Written Application Review",
    headline: "FREE Short Written Application Review",
    subtitle: "Component Feedback",
    category: "Admissions",
    shopGroup: "quick",
    coins: 100,
    estimatedValue: 50,
    description: "A mentor reviews one application component and shares clear next steps.",
    iconTone: "blue",
    tier: "common"
  },
  {
    id: "major-career-fit",
    title: "Major / Career Fit Session",
    headline: "FREE Major / Career Fit Session",
    subtitle: "Major Exploration",
    category: "Planning",
    shopGroup: "support",
    coins: 120,
    estimatedValue: 35,
    description: "A mentor helps the student explore possible majors, career paths, and college fit.",
    iconTone: "indigo",
    tier: "uncommon"
  },
  {
    id: "mock-interview",
    title: "Mock Interview Session",
    headline: "FREE Mock Interview Session",
    subtitle: "Interview Practice",
    category: "Admissions",
    shopGroup: "support",
    coins: 130,
    estimatedValue: 35,
    description: "A mentor runs a college-style mock interview and gives feedback.",
    iconTone: "purple",
    tier: "rare"
  },
  {
    id: "test-prep-help",
    title: "SAT / ACT Help Session",
    headline: "FREE SAT / ACT Help Session",
    subtitle: "Test Prep Support",
    category: "Test Prep",
    shopGroup: "support",
    coins: 150,
    estimatedValue: 50,
    description: "Choose SAT Math, SAT Reading/Writing, ACT Math, ACT English, ACT Reading, or ACT Science after redeeming.",
    iconTone: "sky",
    requiresSelection: true,
    tier: "rare"
  },
  {
    id: "essay-review-session",
    title: "Essay Review Session",
    headline: "FREE Essay Review Session",
    subtitle: "2 Mentor Review",
    category: "Essays",
    shopGroup: "support",
    coins: 175,
    estimatedValue: 75,
    description: "Two mentors review the student's essay and leave detailed feedback.",
    featured: true,
    iconTone: "mint",
    tier: "rare"
  },
  {
    id: "bonus-flexible-session",
    title: "Bonus Flexible 1-on-1 Session",
    headline: "FREE Bonus Flexible 1-on-1 Session",
    subtitle: "Extra Live Support",
    category: "Mentorship",
    shopGroup: "premium",
    coins: 200,
    estimatedValue: 75,
    description: "Redeem an extra flexible live session for consulting, SAT/ACT, or academic tutoring.",
    iconTone: "rose",
    tier: "epic"
  },
  {
    id: "application-readiness-review",
    title: "Full Application Readiness Review",
    headline: "FREE Full Application Readiness Review",
    subtitle: "Submission Check",
    category: "Admissions",
    shopGroup: "premium",
    coins: 225,
    estimatedValue: 90,
    description: "A mentor reviews application readiness across essays, activities, and school list priorities.",
    iconTone: "amber",
    tier: "epic"
  },
  {
    id: "multi-mentor-review-package",
    title: "Multi-Mentor Review Package",
    headline: "FREE Multi-Mentor Review Package",
    subtitle: "Team Feedback",
    category: "Essays",
    shopGroup: "premium",
    coins: 250,
    estimatedValue: 100,
    description: "Multiple mentors review key application materials and share coordinated feedback.",
    iconTone: "peach",
    tier: "legendary"
  }
];

export const STATUS_TIERS = STATUS_MILESTONES.map((m, i) => {
  const next = STATUS_MILESTONES[i + 1];
  return {
    id: m.id,
    name: m.name,
    min: m.coinsRequired,
    max: next ? next.coinsRequired - 1 : Infinity,
    multiplier: m.multiplier,
    benefits: [`${m.multiplier.toFixed(1)}x coin multiplier on earned coins`]
  };
});

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
  { id: "fafsa-completed", title: "FAFSA Completed", category: "admissions", coins: 35, grades: [12], priority: [12] },
  { id: "acceptance-received", title: "Acceptance Received", category: "admissions", coins: 60, grades: [12], priority: [12] },
  { id: "momentum-3-day", title: "3-Day Momentum Streak", category: "momentum", coins: 15, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "momentum-7-day", title: "7-Day Momentum Streak", category: "momentum", coins: 30, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "momentum-14-day", title: "14-Day Momentum Streak", category: "momentum", coins: 50, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "weekly-check-in", title: "Weekly Check-In Completed", category: "momentum", coins: 20, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "mentor-meeting-completed", title: "Mentor Meeting Completed", category: "momentum", coins: 25, grades: ALL_GRADES, priority: ALL_GRADES },
  { id: "diagnostic-test", title: "Diagnostic Test Completed", category: "sat_act", coins: 25, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "first-practice-review", title: "First Practice Test Reviewed", category: "sat_act", coins: 30, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "study-roadmap-created", title: "Study Roadmap Created", category: "sat_act", coins: 25, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
  { id: "sat-prep-7-day", title: "7-Day SAT Prep Streak", category: "sat_act", coins: 35, grades: [10, 11, 12], priority: [11], requiresService: "satActPrep" },
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
  return getCurrentStatusMilestone(coins);
}

export function getNextStatusTier(coins) {
  return getNextStatusMilestone(coins);
}

export function getTierProgress(coins) {
  const current = getCurrentStatusMilestone(coins);
  const next = getNextStatusMilestone(coins);
  if (!next) return 100;
  const span = next.coinsRequired - current.coinsRequired;
  const earned = coins - current.coinsRequired;
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
  const { tierId, tierConfig } = resolveRewardTier(reward);
  return {
    ...reward,
    tier: tierId,
    tierConfig,
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

/** Full pool for the 24-hour Reward Shop (excludes featured reward). */
export const REWARD_SHOP_POOL_IDS = REWARD_CATALOG
  .filter((r) => !r.featured)
  .map((r) => r.id);

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

export function buildSidebarProgress(isJordan, coins, completedCount, metrics = {}) {
  if (!isJordan) {
    return {
      milestonesCompleted: completedCount,
      currentStreak: Number(metrics.currentStreak || 0),
      meetingsCompleted: Number(metrics.meetingsCompleted || 0),
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
    lifetimeCoins: raw.lifetimeCoins ?? raw.lifetime_coins ?? raw.lifetimeEarned ?? 0,
    completed: raw.completed ?? [],
    inProgress: raw.inProgress ?? [],
    inProgressProgress: raw.inProgressProgress ?? {},
    redeemed: raw.redeemed ?? [],
    redemptionHistory: raw.redemptionHistory ?? []
  };
}
