/** Student gamification — private progress, no leaderboards. */

export const LEVELS = [
  { level: 1, name: "Getting Started", xp: 0 },
  { level: 2, name: "Building Momentum", xp: 100 },
  { level: 3, name: "Application Explorer", xp: 250 },
  { level: 4, name: "Essay Builder", xp: 450 },
  { level: 5, name: "Deadline Master", xp: 700 },
  { level: 6, name: "Application Ready", xp: 1000 }
];

export const BADGE_CATALOG = {
  first_step: { id: "first_step", name: "First Step", desc: "Complete onboarding survey" },
  profile_pro: { id: "profile_pro", name: "Profile Pro", desc: "Complete full student profile" },
  essay_starter: { id: "essay_starter", name: "Essay Starter", desc: "Create first essay draft" },
  consistency_streak: { id: "consistency_streak", name: "Consistency Streak", desc: "7-day task streak" },
  college_explorer: { id: "college_explorer", name: "College Explorer", desc: "Add five colleges" },
  mentor_momentum: { id: "mentor_momentum", name: "Mentor Momentum", desc: "Attend three mentor meetings" },
  deadline_defender: { id: "deadline_defender", name: "Deadline Defender", desc: "Five tasks before due date" }
};

export function levelFromXp(xp) {
  let current = LEVELS[0];
  for (const L of LEVELS) {
    if (xp >= L.xp) current = L;
    else break;
  }
  const next = LEVELS.find((L) => L.xp > xp);
  const xpInLevel = xp - current.xp;
  const xpToNext = next ? next.xp - current.xp : 0;
  const progress = next ? Math.round((xpInLevel / xpToNext) * 100) : 100;
  return { ...current, next, xpInLevel, xpToNext, progress, totalXp: xp };
}

export function buildDefaultGamification(isJordan) {
  const missions = isJordan
    ? [
        { id: "m-ps", title: "Finish your personal statement outline", xp: 40, priority: "high", due: "Apr 12", done: false },
        { id: "m-colleges", title: "Add two colleges to your list", xp: 20, priority: "medium", due: "Apr 15", done: false },
        { id: "m-ec", title: "Update extracurricular descriptions", xp: 30, priority: "medium", due: "Apr 18", done: true },
        { id: "m-meet", title: "Attend your mentor meeting", xp: 50, priority: "high", due: "This week", done: false },
        { id: "m-scholar", title: "Review one scholarship opportunity", xp: 25, priority: "low", due: "Apr 20", done: false }
      ]
    : [
        { id: "m-fafsa", title: "Complete FAFSA checklist items", xp: 35, priority: "high", due: "Apr 10", done: false },
        { id: "m-essay", title: "Revise personal statement intro", xp: 40, priority: "high", due: "Apr 8", done: false },
        { id: "m-list", title: "Send updated college list to mentor", xp: 20, priority: "medium", due: "Apr 14", done: true },
        { id: "m-meet", title: "Attend your mentor meeting", xp: 50, priority: "high", due: "This week", done: false }
      ];

  return {
    xp: isJordan ? 420 : 285,
    streak: isJordan ? 5 : 3,
    missions,
    badges: isJordan
      ? [
          { ...BADGE_CATALOG.first_step, unlockedAt: "May 12" },
          { ...BADGE_CATALOG.essay_starter, unlockedAt: "May 28" },
          { ...BADGE_CATALOG.profile_pro, unlockedAt: "Jun 1" }
        ]
      : [
          { ...BADGE_CATALOG.first_step, unlockedAt: "May 8" },
          { ...BADGE_CATALOG.essay_starter, unlockedAt: "May 22" }
        ],
    nextBadge: {
      ...BADGE_CATALOG.college_explorer,
      current: isJordan ? 3 : 2,
      target: 5,
      progress: isJordan ? 60 : 40
    },
    activityFeed: isJordan
      ? [
          { id: "a1", type: "xp", text: "Earned +30 XP", sub: "Updated extracurriculars", time: "2h ago" },
          { id: "a2", type: "task", text: "Completed mission", sub: "Extracurricular update", time: "2h ago" },
          { id: "a3", type: "college", text: "Updated college list", sub: "Added Northeastern (Target)", time: "Yesterday" },
          { id: "a4", type: "essay", text: "Essay draft saved", sub: "Personal Statement v2", time: "Yesterday" },
          { id: "a5", type: "meeting", text: "Meeting scheduled", sub: "College List Strategy", time: "2d ago" }
        ]
      : [
          { id: "a1", type: "task", text: "Completed mission", sub: "College list sent to mentor", time: "5h ago" },
          { id: "a2", type: "essay", text: "Essay draft updated", sub: "NYU Supplement", time: "Yesterday" },
          { id: "a3", type: "xp", text: "Earned +20 XP", sub: "Weekly mission", time: "Yesterday" }
        ],
    applicationProgressPct: isJordan ? 68 : 54
  };
}
