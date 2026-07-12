import { REWARD_TASK_STATUS } from "../../lib/rewardTaskCatalog.js";

const LOGIN_STREAK_TEMPLATE = "momentum-7-day-login-streak";
const MEETING_TASK_TEMPLATE = "mentor-meeting-completed";

/**
 * Build a single normalized rewards snapshot from authoritative server/task data.
 */
export function buildRewardsSnapshot({
  wallet = null,
  tasks = [],
  redemptions = [],
  redemptionHistory = []
}) {
  const coins = Number(wallet?.coin_balance ?? wallet?.coinBalance ?? 0);
  const redeemedIds = [
    ...new Set([
      ...redemptions.map((row) => row.reward_id || row.rewardId),
      ...redemptionHistory.map((row) => row.rewardId).filter(Boolean)
    ])
  ];

  const loginTask = tasks.find((task) => task.taskTemplateId === LOGIN_STREAK_TEMPLATE);
  const loginStreak = loginTask?.progressCurrent ?? 0;
  const milestonesCompleted = tasks.filter((task) => task.status === REWARD_TASK_STATUS.CLAIMED).length;
  const meetingsCompleted = tasks.filter(
    (task) => task.taskTemplateId === MEETING_TASK_TEMPLATE && task.status === REWARD_TASK_STATUS.CLAIMED
  ).length;

  return {
    coins,
    lifetimeCoins: Number(
      wallet?.lifetime_coins ?? wallet?.lifetimeCoins ?? wallet?.lifetime_earned ?? wallet?.lifetimeEarned ?? 0
    ),
    lifetimeEarned: Number(wallet?.lifetime_earned ?? wallet?.lifetimeEarned ?? wallet?.lifetime_coins ?? 0),
    lifetimeClaimed: Number(wallet?.lifetime_claimed ?? wallet?.lifetimeClaimed ?? 0),
    loginStreak,
    milestonesCompleted,
    meetingsCompleted,
    redeemedIds,
    redemptionHistory: mergeRedemptionHistory(redemptions, redemptionHistory),
    syncedAt: new Date().toISOString()
  };
}

function mergeRedemptionHistory(serverRows = [], localRows = []) {
  const mapped = serverRows.map((row) => ({
    id: row.id,
    rewardId: row.reward_id || row.rewardId,
    title: row.title,
    status: row.status,
    redeemedAt: row.redeemed_at || row.redeemedAt,
    selection: row.selection || null
  }));
  const seen = new Set(mapped.map((row) => row.id));
  for (const row of localRows) {
    if (!seen.has(row.id)) mapped.push(row);
  }
  return mapped.sort((a, b) => String(b.redeemedAt).localeCompare(String(a.redeemedAt)));
}

export function buildSidebarProgressFromSnapshot(snapshot) {
  return {
    milestonesCompleted: snapshot.milestonesCompleted,
    currentStreak: snapshot.loginStreak,
    meetingsCompleted: snapshot.meetingsCompleted,
    coinsEarned: snapshot.coins
  };
}
