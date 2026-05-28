import { getPlan } from "./plans.js";
import { attachRoadmapToUser, ensureRoadmap, getUserRecord } from "./userProfile.js";

const STORAGE_KEY = "prelude_session";
const USERS_KEY = "prelude_users";

const DEMO_USERS = {
  "student@prelude.demo": {
    password: "demo123",
    name: "Alex Kim",
    plan: "plus",
    role: "student",
    grade: "11",
    focus: "essays and building a balanced college list",
    roadmap: {
      completedNodes: ["profile", "goals", "identity"],
      currentNodeId: "college-list",
      lastChatCategory: "collegeList",
      insights: { concerns: ["essay", "collegeList"], targetSchools: [], notes: [] }
    }
  },
  "parent@prelude.demo": {
    password: "demo123",
    name: "Jordan Lee",
    plan: "pro",
    role: "parent",
    grade: null,
    focus: "affordability, deadlines, and supporting my student",
    roadmap: {
      completedNodes: ["profile", "goals", "financial"],
      currentNodeId: "deadlines",
      lastChatCategory: "financial",
      insights: { concerns: ["financial", "parent"], targetSchools: [], notes: [] }
    }
  },
  "basic@prelude.demo": {
    password: "demo123",
    name: "Sam Rivera",
    plan: "basic",
    role: "student",
    grade: "10",
    focus: "getting started with college planning",
    roadmap: {
      completedNodes: ["profile"],
      currentNodeId: "goals",
      lastChatCategory: "gettingStarted",
      insights: { concerns: ["gettingStarted"], targetSchools: [], notes: [] }
    }
  }
};

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

function toPublicUser(record, email) {
  const plan = getPlan(record.plan);
  return {
    email,
    name: record.name,
    plan: record.plan,
    planName: plan.name,
    role: record.role ?? "student",
    grade: record.grade ?? null,
    focus: record.focus ?? ""
  };
}

function ensureUserInStore(email) {
  const normalized = email.toLowerCase();
  const users = readUsers();
  if (!users[normalized] && DEMO_USERS[normalized]) {
    users[normalized] = { ...DEMO_USERS[normalized] };
    writeUsers(users);
  }
  return users[normalized] ?? DEMO_USERS[normalized] ?? null;
}

function hydrateUser(email) {
  const normalized = email.toLowerCase();
  const base = ensureUserInStore(normalized);
  if (!base) return null;
  ensureRoadmap(normalized, base);
  const full = getUserRecord(normalized) ?? base;
  return attachRoadmapToUser(toPublicUser(full, normalized), full);
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return hydrateUser(session.email);
  } catch {
    return null;
  }
}

export function persistSession(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: user.email }));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function signIn(email, password) {
  const normalized = email.trim().toLowerCase();
  const users = { ...readUsers(), ...DEMO_USERS };
  const record = users[normalized];

  if (!record || record.password !== password) {
    const error = new Error("Invalid email or password.");
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }

  ensureUserInStore(normalized);
  const user = hydrateUser(normalized);
  persistSession(user);
  return user;
}

export function signUp({ email, password, name, plan, role, grade, focus }) {
  const normalized = email.trim().toLowerCase();
  const users = readUsers();

  if (DEMO_USERS[normalized] || users[normalized]) {
    const error = new Error("An account with this email already exists.");
    error.code = "EMAIL_EXISTS";
    throw error;
  }

  if (!password || password.length < 6) {
    const error = new Error("Password must be at least 6 characters.");
    error.code = "WEAK_PASSWORD";
    throw error;
  }

  users[normalized] = {
    password,
    name: name.trim(),
    plan: plan ?? "basic",
    role: role ?? "student",
    grade: grade || null,
    focus: focus?.trim() || "college planning"
  };

  writeUsers(users);
  const user = hydrateUser(normalized);
  persistSession(user);
  return user;
}

export function signOut() {
  clearSession();
}

export function getUserBaseRecord(email) {
  return getUserRecord(email?.toLowerCase()) ?? ensureUserInStore(email);
}

export const DEMO_HINT =
  "Try student@prelude.demo, parent@prelude.demo, or basic@prelude.demo — password: demo123";
