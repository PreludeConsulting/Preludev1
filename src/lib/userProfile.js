import {
  ALL_NODE_IDS,
  getDefaultRoadmapProgress,
  nodesForCategory
} from "./roadmapData.js";

const USERS_KEY = "prelude_users";

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUserRecord(email) {
  const users = readUsers();
  return users[email?.toLowerCase()] ?? null;
}

export function saveUserRecord(email, record) {
  const users = readUsers();
  users[email.toLowerCase()] = record;
  writeUsers(users);
}

export function mergeDemoRecord(email, demoRecord) {
  const stored = getUserRecord(email);
  if (!stored) return demoRecord;
  return {
    ...demoRecord,
    ...stored,
    password: demoRecord.password ?? stored.password,
    roadmap: { ...getDefaultRoadmapProgress(), ...demoRecord.roadmap, ...stored.roadmap }
  };
}

export function ensureRoadmap(email, baseRecord) {
  const users = readUsers();
  const key = email.toLowerCase();
  const existing = users[key] ?? { ...baseRecord };
  if (!existing.roadmap) {
    existing.roadmap = getDefaultRoadmapProgress();
    if (existing.grade) {
      existing.roadmap.completedNodes = ["profile"];
      existing.roadmap.currentNodeId = "goals";
    }
    if (existing.focus) {
      if (!existing.roadmap.completedNodes.includes("goals")) {
        existing.roadmap.completedNodes.push("goals");
      }
      existing.roadmap.currentNodeId = "identity";
    }
    users[key] = existing;
    writeUsers(users);
  }
  return existing.roadmap;
}

export function applyChatInsights(email, { category, userText, baseRecord }) {
  if (!email) return null;

  const users = readUsers();
  const key = email.toLowerCase();
  const record = users[key] ?? { ...baseRecord };
  const roadmap = { ...getDefaultRoadmapProgress(), ...record.roadmap };

  roadmap.lastChatCategory = category ?? roadmap.lastChatCategory;

  const related = nodesForCategory(category);
  if (related.length && !roadmap.completedNodes.includes(related[0])) {
    roadmap.currentNodeId = related[0];
  }

  const insights = { ...roadmap.insights };
  const text = (userText ?? "").toLowerCase();

  if (/\b(11th|11|junior|12th|12|senior|10th|10|sophomore)\b/.test(text)) {
    record.grade = record.grade ?? text.match(/\b(1[0-2]|senior|junior|sophomore)\b/i)?.[0];
  }

  if (category && !insights.concerns.includes(category)) {
    insights.concerns = [...insights.concerns, category].slice(-6);
  }

  if (/\bmit\b|\bucla\b|\bnyu\b|\bharvard\b|\bstanford\b/i.test(userText ?? "")) {
    const schools = userText.match(/\b(MIT|UCLA|NYU|Harvard|Stanford|Georgia Tech|UT Austin)\b/gi) ?? [];
    insights.targetSchools = [...new Set([...insights.targetSchools, ...schools])].slice(-8);
  }

  if (category && related.length) {
    const completed = new Set(roadmap.completedNodes);
    if (text.length > 20) {
      completed.add(related[0]);
    }
    roadmap.completedNodes = [...completed];
    const nextIdx = ALL_NODE_IDS.indexOf(related[0]) + 1;
    if (nextIdx < ALL_NODE_IDS.length) {
      roadmap.currentNodeId = ALL_NODE_IDS[nextIdx];
    }
  }

  roadmap.insights = insights;
  record.roadmap = roadmap;
  users[key] = { ...baseRecord, ...record };
  writeUsers(users);

  return roadmap;
}

export function attachRoadmapToUser(publicUser, fullRecord) {
  return {
    ...publicUser,
    roadmap: fullRecord?.roadmap ?? getDefaultRoadmapProgress(),
    grade: fullRecord?.grade ?? publicUser.grade,
    focus: fullRecord?.focus ?? publicUser.focus
  };
}
