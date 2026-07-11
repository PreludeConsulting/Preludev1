import { describe, expect, it } from "vitest";
import { buildRewardsSnapshot, buildSidebarProgressFromSnapshot } from "../src/dashboard/lib/rewardsSnapshot.js";
import { REWARD_TASK_STATUS } from "../src/lib/rewardTaskCatalog.js";

describe("rewardsSnapshot", () => {
  it("derives coins, streak, and redemption ids from one wallet + task snapshot", () => {
    const snapshot = buildRewardsSnapshot({
      wallet: { coin_balance: 42, lifetime_earned: 80, lifetime_claimed: 38 },
      tasks: [
        {
          taskTemplateId: "momentum-7-day-login-streak",
          status: REWARD_TASK_STATUS.IN_PROGRESS,
          progressCurrent: 5,
          progressTarget: 7
        },
        {
          taskTemplateId: "mentor-meeting-completed",
          status: REWARD_TASK_STATUS.CLAIMED
        },
        {
          taskTemplateId: "college-list-started",
          status: REWARD_TASK_STATUS.CLAIMED
        }
      ],
      redemptions: [{ id: "r1", reward_id: "essay-review", title: "Essay review", redeemed_at: "2026-07-10T12:00:00.000Z" }]
    });

    expect(snapshot.coins).toBe(42);
    expect(snapshot.loginStreak).toBe(5);
    expect(snapshot.milestonesCompleted).toBe(2);
    expect(snapshot.redeemedIds).toEqual(["essay-review"]);

    const sidebar = buildSidebarProgressFromSnapshot(snapshot);
    expect(sidebar).toMatchObject({
      currentStreak: 5,
      milestonesCompleted: 2,
      coinsEarned: 42
    });
  });
});
