/** College application roadmap — Duolingo-style path structure. */

export const ROADMAP_SECTIONS = [
  {
    id: "start",
    sectionLabel: "Section 1",
    unitLabel: "Unit 1",
    title: "Get oriented",
    nodes: [
      { id: "profile", title: "Your profile", type: "lesson", icon: "user", aiKey: "gettingStarted" },
      { id: "goals", title: "Goals & focus", type: "lesson", icon: "sparkles", aiKey: "gettingStarted" },
      { id: "chest-1", title: "Starter resources", type: "chest", icon: "chest" }
    ]
  },
  {
    id: "build",
    sectionLabel: "Section 2",
    unitLabel: "Unit 2",
    title: "Build your application",
    nodes: [
      { id: "identity", title: "Identity & story", type: "lesson", icon: "sparkles", aiKey: "essay" },
      { id: "college-list", title: "College list", type: "lesson", icon: "map", aiKey: "collegeList" },
      { id: "essays", title: "Essays & prompts", type: "lesson", icon: "book", aiKey: "essay" },
      { id: "chest-2", title: "Essay toolkit", type: "chest", icon: "chest" },
      { id: "financial", title: "Aid & scholarships", type: "lesson", icon: "dollar", aiKey: "financial" },
      { id: "deadlines", title: "Deadlines", type: "lesson", icon: "calendar", aiKey: "timeline" },
      { id: "interview", title: "Interview prep", type: "lesson", icon: "compass", aiKey: "mentorship" }
    ]
  },
  {
    id: "apply",
    sectionLabel: "Section 3",
    unitLabel: "Unit 3",
    title: "Apply with confidence",
    nodes: [
      { id: "review", title: "Application review", type: "lesson", icon: "check", aiKey: "essay" },
      { id: "mentor", title: "Mentor match", type: "lesson", icon: "users", aiKey: "mentorship" },
      { id: "chest-3", title: "Final checklist", type: "chest", icon: "chest" }
    ]
  }
];

export const ALL_NODE_IDS = ROADMAP_SECTIONS.flatMap((s) => s.nodes.map((n) => n.id));

export function getNodeById(nodeId) {
  for (const section of ROADMAP_SECTIONS) {
    const node = section.nodes.find((n) => n.id === nodeId);
    if (node) return { ...node, section };
  }
  return null;
}

export function getDefaultRoadmapProgress() {
  return {
    completedNodes: [],
    currentNodeId: "profile",
    lastChatCategory: null,
    insights: {
      concerns: [],
      targetSchools: [],
      notes: []
    }
  };
}

/** Map AI conversation categories to roadmap nodes. */
export const CATEGORY_TO_NODES = {
  gettingStarted: ["profile", "goals"],
  collegeList: ["college-list"],
  essay: ["identity", "essays", "review"],
  financial: ["financial"],
  timeline: ["deadlines"],
  major: ["goals", "college-list"],
  mentorship: ["mentor", "interview"],
  transfer: ["college-list", "essays"],
  parent: ["financial", "deadlines"],
  stress: ["goals"],
  about: ["profile"]
};

export function nodesForCategory(category) {
  return CATEGORY_TO_NODES[category] ?? [];
}
