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

/** Flat Pro-plan bonus added on top of the status-tier multiplier. */
export const PRO_PLAN_COIN_BOOST = 0.25;

export function getStatusCoinMultiplier(lifetimeCoins = 0) {
  return getCurrentStatusMilestone(lifetimeCoins).multiplier;
}

/**
 * Final coin multiplier = status tier multiplier (+ Pro boost when eligible).
 * @param {number} lifetimeCoins
 * @param {{ proBoost?: boolean }} [options]
 */
export function getCoinMultiplier(lifetimeCoins = 0, { proBoost = false } = {}) {
  const statusMultiplier = getStatusCoinMultiplier(lifetimeCoins);
  if (!proBoost) return statusMultiplier;
  return Math.round((statusMultiplier + PRO_PLAN_COIN_BOOST) * 100) / 100;
}

export function formatMultiplierLabel(multiplier) {
  const n = Math.round((Number(multiplier) || 1) * 100) / 100;
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
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

export const TUTORING_SUBJECT_OPTIONS = [
  "Math",
  "English / Writing",
  "Science",
  "History / Social Studies",
  "World Language",
  "Other (confirm with tutor)"
];

export const REWARD_FULFILLMENT_TYPES = {
  ASYNC_WRITTEN: "async_written",
  LIVE_CALL: "live_call"
};

/** Retired catalog IDs — kept for history readability; not shown in shop rotations. */
export const RETIRED_REWARD_IDS = [
  "priority-office-hours",
  "quick-essay-feedback",
  "short-application-review",
  "major-career-fit",
  "mock-interview",
  "test-prep-help",
  "essay-review-session",
  "bonus-flexible-session",
  "application-readiness-review",
  "multi-mentor-review-package",
  "college-list-review-legacy",
  "activities-list-review-legacy",
  "application-strategy-call",
  "scholarship-search",
  "parent-strategy-call"
];

/**
 * Active redeemable catalog.
 * `headline` mirrors `title` (no "FREE" prefix) — cards and history use headline.
 */
export const REWARD_CATALOG = [
  {
    id: "supplemental-essay-one",
    title: "Supplemental Essay Review | One Essay",
    headline: "Supplemental Essay Review | One Essay",
    subtitle: "Written Application Feedback",
    category: "Essays",
    shopPool: "daily",
    coins: 125,
    estimatedValue: 50,
    description: "Receive detailed written feedback on one supplemental essay from a Prelude mentor. Asynchronous — no live call included.",
    confirmationDetails:
      "Includes written feedback on one supplemental essay, up to 350 words. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One supplemental essay, up to 350 words",
    wordLimit: 350,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: "supplemental",
    iconTone: "mint",
    tier: "common",
    active: true
  },
  {
    id: "supplemental-essay-college",
    title: "Supplemental Essay Review | One College",
    headline: "Supplemental Essay Review | One College",
    subtitle: "Written Application Feedback",
    category: "Essays",
    shopPool: "daily",
    coins: 175,
    estimatedValue: 70,
    description: "Receive detailed written feedback on the supplemental essays for one college. Asynchronous — no live call included.",
    confirmationDetails:
      "Includes written feedback on all supplemental essays for one college, up to 750 total words. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "All supplemental essays for one college, up to 750 total words",
    wordLimit: 750,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: "supplemental",
    iconTone: "mint",
    tier: "rare",
    active: true
  },
  {
    id: "personal-statement-review",
    title: "Personal Statement Review",
    headline: "Personal Statement Review",
    subtitle: "Written Application Feedback",
    category: "Essays",
    shopPool: "daily",
    coins: 175,
    estimatedValue: 70,
    description: "Receive detailed written feedback on one personal statement draft. Asynchronous — no live call included.",
    confirmationDetails:
      "Includes written feedback on one Common App personal statement draft. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One Common App personal statement draft",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: null,
    iconTone: "blue",
    tier: "rare",
    active: true
  },
  {
    id: "activities-list-review",
    title: "Activities List Review",
    headline: "Activities List Review",
    subtitle: "Written Application Feedback",
    category: "Activities",
    shopPool: "daily",
    coins: 150,
    estimatedValue: 55,
    description: "Receive written feedback on the complete Common App activities section.",
    confirmationDetails:
      "Includes written feedback on the student’s complete Common App activities section. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "Complete Common App activities section",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: "activities",
    iconTone: "indigo",
    tier: "uncommon",
    active: true
  },
  {
    id: "activities-honors-review",
    title: "Activities & Honors Review",
    headline: "Activities & Honors Review",
    subtitle: "Written Application Feedback",
    category: "Activities",
    shopPool: "daily",
    coins: 200,
    estimatedValue: 80,
    description: "Receive detailed written feedback on your complete activities and honors sections.",
    confirmationDetails:
      "Includes written feedback on the complete Common App activities and honors sections. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "Complete Common App activities and honors sections",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: "activities",
    iconTone: "indigo",
    tier: "rare",
    active: true
  },
  {
    id: "college-list-review",
    title: "College List Review",
    headline: "College List Review",
    subtitle: "Written Application Feedback",
    category: "Planning",
    shopPool: "daily",
    coins: 150,
    estimatedValue: 55,
    description: "Receive written feedback on the balance, fit, and overall structure of your college list. Written feedback only — not a live consulting call.",
    confirmationDetails:
      "Includes written feedback on one current college list (balance, fit, and structure). This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One current college list",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: null,
    iconTone: "amber",
    tier: "uncommon",
    active: true
  },
  {
    id: "student-resume-review",
    title: "Student Résumé Review",
    headline: "Student Résumé Review",
    subtitle: "Written Application Feedback",
    category: "Activities",
    shopPool: "daily",
    coins: 150,
    estimatedValue: 55,
    description: "Receive detailed written feedback on one college-application résumé.",
    confirmationDetails:
      "Includes written feedback on one college-application résumé. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One college-application résumé",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: null,
    iconTone: "blue",
    tier: "uncommon",
    active: true
  },
  {
    id: "scholarship-essay-review",
    title: "Scholarship Essay Review",
    headline: "Scholarship Essay Review",
    subtitle: "Written Application Feedback",
    category: "Essays",
    shopPool: "daily",
    coins: 150,
    estimatedValue: 55,
    description: "Receive detailed written feedback on one scholarship essay.",
    confirmationDetails:
      "Includes written feedback on one scholarship essay, up to 750 words. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One scholarship essay, up to 750 words",
    wordLimit: 750,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: null,
    iconTone: "mint",
    tier: "uncommon",
    active: true
  },
  {
    id: "sat-act-help-session",
    title: "SAT/ACT Help Session",
    headline: "SAT/ACT Help Session",
    subtitle: "Live 30-minute call",
    category: "Test Prep",
    shopPool: "daily",
    coins: 325,
    estimatedValue: 100,
    description: "Meet with a test-prep mentor for a 30-minute live SAT or ACT help session. Subject availability must be confirmed when scheduling.",
    confirmationDetails:
      "Includes one 30-minute live SAT or ACT help session. This is a live call (not asynchronous written feedback). Mentor availability must be confirmed when scheduling.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.LIVE_CALL,
    scope: "One 30-minute live SAT or ACT help session",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    requiresSelection: true,
    selectionType: "test_prep",
    similarityGroup: "live_academic",
    iconTone: "sky",
    tier: "epic",
    active: true
  },
  {
    id: "academic-tutoring-session",
    title: "Academic Tutoring Session",
    headline: "Academic Tutoring Session",
    subtitle: "Live 30-minute call",
    category: "Tutoring",
    shopPool: "daily",
    coins: 375,
    estimatedValue: 115,
    description: "Meet with a tutor for one 30-minute academic tutoring session. Subject and tutor availability must be confirmed when scheduling.",
    confirmationDetails:
      "Includes one 30-minute live academic tutoring session. This is a live call (not asynchronous written feedback). Subject and tutor availability must be confirmed when scheduling.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.LIVE_CALL,
    scope: "One 30-minute tutoring session in an available academic subject",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    requiresSelection: true,
    selectionType: "tutoring_subject",
    similarityGroup: "live_academic",
    iconTone: "rose",
    tier: "epic",
    active: true
  },
  {
    id: "two-mentor-personal-statement",
    title: "Two-Mentor Personal Statement Review",
    headline: "Two-Mentor Personal Statement Review",
    subtitle: "Written Application Feedback",
    category: "Essays",
    shopPool: "legendary",
    coins: 275,
    estimatedValue: 110,
    description: "Two Prelude mentors independently review one personal statement and provide detailed written feedback. Asynchronous — no live call included.",
    confirmationDetails:
      "Two Prelude mentors independently review one personal statement draft and provide detailed written feedback. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One personal statement draft",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 2,
    similarityGroup: null,
    iconTone: "mint",
    tier: "legendary",
    active: true
  },
  {
    id: "full-written-application-one-college",
    title: "Full Written Application Review | One College",
    headline: "Full Written Application Review | One College",
    subtitle: "Written Application Feedback",
    category: "Admissions",
    shopPool: "legendary",
    coins: 350,
    estimatedValue: 140,
    description: "Receive a complete written review of one college’s application materials, excluding the personal statement. Asynchronous — no live call included.",
    confirmationDetails:
      "Includes one college’s supplemental essays and the student’s activities, honors, and Additional Information sections. The personal statement is not included. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "One college’s supplemental essays plus activities, honors, and Additional Information",
    wordLimit: null,
    exclusions: "Personal statement is not included",
    mentorsRequired: 1,
    similarityGroup: null,
    iconTone: "amber",
    tier: "legendary",
    active: true
  },
  {
    id: "two-mentor-supplemental-one-college",
    title: "Two-Mentor Supplemental Review | One College",
    headline: "Two-Mentor Supplemental Review | One College",
    subtitle: "Written Application Feedback",
    category: "Essays",
    shopPool: "legendary",
    coins: 300,
    estimatedValue: 120,
    description: "Two Prelude mentors independently review the supplemental essays for one college. Asynchronous — no live call included.",
    confirmationDetails:
      "Two Prelude mentors independently review all supplemental essays for one college, up to 750 total words. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "All supplemental essays for one college, up to 750 total words",
    wordLimit: 750,
    exclusions: null,
    mentorsRequired: 2,
    similarityGroup: null,
    iconTone: "mint",
    tier: "legendary",
    active: true
  },
  {
    id: "complete-activities-honors-resume",
    title: "Complete Activities, Honors & Résumé Review",
    headline: "Complete Activities, Honors & Résumé Review",
    subtitle: "Written Application Feedback",
    category: "Activities",
    shopPool: "legendary",
    coins: 275,
    estimatedValue: 110,
    description: "Receive a complete written review of your activities, honors, and college résumé. Asynchronous — no live call included.",
    confirmationDetails:
      "Includes a complete written review of the Common App activities section, honors section, and one college-application résumé. This reward is asynchronous and does not include a live call.",
    fulfillmentType: REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN,
    scope: "Complete activities section, honors section, and one college-application résumé",
    wordLimit: null,
    exclusions: null,
    mentorsRequired: 1,
    similarityGroup: null,
    iconTone: "indigo",
    tier: "legendary",
    active: true
  }
];

export const ACTIVE_REWARD_CATALOG = REWARD_CATALOG.filter((r) => r.active !== false);

export function getRewardById(rewardId, catalog = REWARD_CATALOG) {
  return catalog.find((r) => r.id === rewardId) || null;
}

export function buildRewardCatalogSnapshot(reward) {
  if (!reward) return null;
  return {
    id: reward.id,
    title: reward.title,
    headline: reward.headline,
    description: reward.description,
    confirmationDetails: reward.confirmationDetails || reward.description,
    coinCost: reward.coins,
    fulfillmentType: reward.fulfillmentType,
    scope: reward.scope || null,
    wordLimit: reward.wordLimit ?? null,
    exclusions: reward.exclusions || null,
    mentorsRequired: reward.mentorsRequired || 1,
    subtitle: reward.subtitle || null,
    tier: reward.tier || null
  };
}

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

/** @deprecated Featured reward rotates weekly — use getFeaturedRewardForPeriod / resolveShopOffers. */
export const FEATURED_REWARD_ID = "two-mentor-personal-statement";

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
  const legendary = catalog.filter((r) => r.shopPool === "legendary" && r.active !== false);
  return legendary[0] || catalog.find((r) => r.featured) || catalog[0];
}

export function getLegendaryRewardPool(catalog = REWARD_CATALOG) {
  return catalog.filter((r) => r.shopPool === "legendary" && r.active !== false);
}

export function getDailyRewardPool(catalog = REWARD_CATALOG) {
  return catalog.filter((r) => r.shopPool === "daily" && r.active !== false);
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
    headline: "Personal Statement Review",
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
  "personal-statement-review",
  "college-list-review",
  "activities-list-review",
  "scholarship-essay-review",
  "sat-act-help-session",
  "academic-tutoring-session"
];

/** Daily shop pool — never includes legendary featured rewards. */
export const REWARD_SHOP_POOL_IDS = REWARD_CATALOG
  .filter((r) => r.shopPool === "daily" && r.active !== false)
  .map((r) => r.id);

export const LEGENDARY_REWARD_IDS = REWARD_CATALOG
  .filter((r) => r.shopPool === "legendary" && r.active !== false)
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
