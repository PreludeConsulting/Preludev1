import {
  ACADEMIC_TUTORING_TASK_DEFS,
  ADMISSIONS_TASK_DEFS,
  MOMENTUM_TASK_DEFS,
  REWARD_TASK_CATEGORY,
  REWARD_TASK_OWNERSHIP,
  REWARD_TASK_STATUS,
  SAT_ACT_TASK_DEFS
} from "./rewardTaskCatalog.js";

function storageKey(email) {
  return `prelude-reward-task-instances-${(email || "guest").toLowerCase()}`;
}

function walletKey(email) {
  return `prelude-reward-wallet-${(email || "guest").toLowerCase()}`;
}

function makeInstance(def, { locked = false } = {}) {
  return {
    id: `local-${def.id}`,
    taskTemplateId: def.id,
    category: def.category,
    title: def.title,
    ownership: def.ownership,
    status: locked ? REWARD_TASK_STATUS.LOCKED : REWARD_TASK_STATUS.IN_PROGRESS,
    coins: def.coins,
    progressCurrent: 0,
    progressTarget: def.targetCount || 1,
    metadata: { mainMentorOnly: Boolean(def.mainMentorOnly) }
  };
}

export function loadLocalRewardTasks(email) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(email)) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveLocalRewardTasks(email, tasks) {
  localStorage.setItem(storageKey(email), JSON.stringify(tasks));
}

export function loadLocalRewardWallet(email) {
  try {
    return JSON.parse(localStorage.getItem(walletKey(email)) || '{"coin_balance":0}');
  } catch {
    return { coin_balance: 0 };
  }
}

export function saveLocalRewardWallet(email, wallet) {
  localStorage.setItem(walletKey(email), JSON.stringify(wallet));
}

export function ensureLocalRewardTasks(email, { satActUnlocked = false, tutoringUnlocked = false } = {}) {
  const existing = loadLocalRewardTasks(email);
  const usedTemplateIds = new Set(existing.map((task) => task.taskTemplateId));
  const next = [...existing];

  for (const def of MOMENTUM_TASK_DEFS) {
    if (usedTemplateIds.has(def.id)) continue;
    next.push(makeInstance(def));
    usedTemplateIds.add(def.id);
  }

  const pools = [
    { category: REWARD_TASK_CATEGORY.ADMISSIONS, defs: ADMISSIONS_TASK_DEFS, count: 5, locked: false },
    { category: REWARD_TASK_CATEGORY.SAT_ACT, defs: SAT_ACT_TASK_DEFS, count: 5, locked: !satActUnlocked },
    { category: REWARD_TASK_CATEGORY.ACADEMIC_TUTORING, defs: ACADEMIC_TUTORING_TASK_DEFS, count: 5, locked: !tutoringUnlocked }
  ];

  for (const pool of pools) {
    const active = next.filter((task) => task.category === pool.category && task.status !== REWARD_TASK_STATUS.CLAIMED);
    const needed = Math.max(0, pool.count - active.length);
    if (!needed) continue;
    const available = pool.defs.filter((def) => !usedTemplateIds.has(def.id)).slice(0, needed);
    for (const def of available) {
      next.push(makeInstance(def, { locked: pool.locked }));
      usedTemplateIds.add(def.id);
    }
  }

  saveLocalRewardTasks(email, next);
  return next;
}

export function completeLocalMentorTask({ studentEmail, taskInstanceId, mentorId, isMainMentor }) {
  const tasks = loadLocalRewardTasks(studentEmail);
  const task = tasks.find((item) => item.id === taskInstanceId);
  if (!task) return { error: "Task not found.", task: null };
  if (task.ownership !== REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED) {
    return { error: "This task is auto-tracked and cannot be completed by mentors.", task: null };
  }
  if (task.status === REWARD_TASK_STATUS.LOCKED) {
    return { error: "Task is locked for this student plan.", task: null };
  }
  if (task.taskTemplateId === "mentor-meeting-completed" && !isMainMentor) {
    return { error: "Only the student's main assigned mentor can complete this task.", task: null };
  }
  if ([REWARD_TASK_STATUS.CLAIMED, REWARD_TASK_STATUS.COMPLETED_BY_MENTOR, REWARD_TASK_STATUS.READY_TO_CLAIM].includes(task.status)) {
    return { error: "Task is already completed.", task };
  }

  const updated = tasks.map((item) =>
    item.id === taskInstanceId
      ? {
          ...item,
          status: REWARD_TASK_STATUS.COMPLETED_BY_MENTOR,
          completedByMentorId: mentorId,
          completedAt: new Date().toISOString(),
          claimableAt: new Date().toISOString(),
          progressCurrent: item.progressTarget || 1
        }
      : item
  );
  saveLocalRewardTasks(studentEmail, updated);
  return { task: updated.find((item) => item.id === taskInstanceId), error: null };
}

export function claimLocalRewardTask(email, taskInstanceId, { satActUnlocked = false, tutoringUnlocked = false } = {}) {
  const tasks = loadLocalRewardTasks(email);
  const task = tasks.find((item) => item.id === taskInstanceId);
  if (!task) return { error: "Reward task not found.", task: null, wallet: null };
  if (task.status === REWARD_TASK_STATUS.CLAIMED) return { error: "Reward already claimed.", task, wallet: null };
  if (![REWARD_TASK_STATUS.READY_TO_CLAIM, REWARD_TASK_STATUS.COMPLETED_BY_MENTOR].includes(task.status)) {
    return { error: "Reward is not claimable yet.", task, wallet: null };
  }

  const wallet = loadLocalRewardWallet(email);
  const nextWallet = {
    coin_balance: Number(wallet.coin_balance || 0) + Number(task.coins || 0)
  };
  saveLocalRewardWallet(email, nextWallet);

  let updated = tasks.map((item) =>
    item.id === taskInstanceId
      ? { ...item, status: REWARD_TASK_STATUS.CLAIMED, claimedAt: new Date().toISOString() }
      : item
  );
  saveLocalRewardTasks(email, updated);
  updated = ensureLocalRewardTasks(email, { satActUnlocked, tutoringUnlocked });
  return { task: updated.find((item) => item.id === taskInstanceId) || task, wallet: nextWallet, error: null };
}
