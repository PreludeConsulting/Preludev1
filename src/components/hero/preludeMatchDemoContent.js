import { MILESTONE_CATALOG, REWARD_CATALOG } from "../../dashboard/lib/progressRewards.js";

function rewardById(id) {
  return REWARD_CATALOG.find((reward) => reward.id === id);
}

function milestoneById(id) {
  return MILESTONE_CATALOG.find((milestone) => milestone.id === id);
}

const essayReviewReward = rewardById("essay-review-session");
const testPrepReward = rewardById("test-prep-help");
const mentorMeetingMilestone = milestoneById("mentor-meeting-completed");

export const HERO_DEMO_REWARDS = {
  essayReview: essayReviewReward,
  testPrep: testPrepReward
};

export const HERO_DEMO_STEPS = [
  {
    id: "match",
    step: "01",
    railLabel: "Match",
    kicker: "PreludeMatch",
    title: "Jordan answers a few sharp questions.",
    body: "Goals, target schools, academic interests, family priorities, and support style become a live mentor profile.",
    metric: "4 min",
    metricLabel: "to signal",
    chips: ["11th grade", "CS + engineering", "UCLA / Duke / Penn"],
    dashboard: {
      title: "Mentor profile",
      rows: [
        ["Support style", "Structured check-ins"],
        ["Primary goal", "STEM admissions plan"]
      ]
    }
  },
  {
    id: "mentor",
    step: "02",
    railLabel: "Mentor",
    kicker: "Near-peer mentor",
    title: "PreludeMatch pairs the student with a mentor who fits the path.",
    body: "The ad needs to feel like software, so the match shows why Maya fits instead of just flashing a percentage.",
    metric: "Strong",
    metricLabel: "mentor fit",
    mentor: {
      initials: "MP",
      name: "Maya Patel",
      detail: "Georgia Tech - STEM essays",
      match: "Strong",
      reasons: ["STEM essay strategy", "Weekly accountability", "Target-school fit"]
    }
  },
  {
    id: "dashboard",
    step: "03",
    railLabel: "Dashboard",
    kicker: "Student dashboard",
    title: "The match turns into this week’s actual work.",
    body: "Parents see structure. Students see the next move. The dashboard makes the consulting process tangible.",
    metric: "3",
    metricLabel: "priority tasks",
    tasks: [
      { label: "Finalize reach school essay prompts", status: "Due this week" },
      { label: "Prepare questions for Maya", status: "Ready" },
      { label: "Review scholarship opportunity", status: "Next" }
    ]
  },
  {
    id: "meeting",
    step: "04",
    railLabel: "Meeting",
    kicker: "Mentor meeting",
    title: "A real meeting becomes measurable momentum.",
    body: "After the session, Prelude updates tasks, records progress, and rewards the student for doing the work.",
    metric: "+25",
    metricLabel: "Prelude Coins",
    meeting: {
      title: "College List Strategy",
      time: "Today - 4:00 PM",
      action: "Attend mentor meeting"
    },
    coins: [
      { label: mentorMeetingMilestone?.title ?? "Mentor Meeting Completed", value: "+25" },
      { label: "Weekly Check-In Completed", value: "+20" }
    ]
  },
  {
    id: "rewards",
    step: "05",
    railLabel: "Rewards",
    kicker: "Reward shop",
    title: "Coins unlock rewards families would otherwise pay for.",
    body: "The game loop is not decoration. It points students toward the same high-value work that drives applications forward.",
    metric: "$75",
    metricLabel: "essay value",
    rewards: [
      {
        title: essayReviewReward?.title ?? "Essay Review Session",
        cost: essayReviewReward?.coins ?? 300,
        tag: "Featured"
      },
      {
        title: testPrepReward?.title ?? "Test Prep Help Session",
        cost: testPrepReward?.coins ?? 250,
        tag: "Next unlock"
      }
    ]
  }
];

export const HERO_RESULT_PAYOFF = {
  title: "Dashboard unlocked",
  subtitle: "The match does not stop at a mentor card. Prelude turns it into a plan, a meeting, and rewards students want to earn.",
  coinsEarned: mentorMeetingMilestone?.coins ?? 25,
  tasks: [
    { label: "Attend mentor meeting", status: "Complete", coins: mentorMeetingMilestone?.coins ?? 25 },
    { label: "Finalize reach school essay prompts", status: "Next", coins: 35 },
    { label: "Update robotics club description", status: "Queued", coins: 20 }
  ],
  rewards: [
    {
      title: essayReviewReward?.title ?? "Essay Review Session",
      coins: essayReviewReward?.coins ?? 300,
      label: "Featured reward"
    },
    {
      title: testPrepReward?.title ?? "Test Prep Help Session",
      coins: testPrepReward?.coins ?? 250,
      label: "Next unlock"
    }
  ]
};

