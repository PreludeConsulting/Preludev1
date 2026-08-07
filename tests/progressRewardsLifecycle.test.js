import { beforeEach, describe, expect, it } from "vitest";
import { chatMessagePreviewText } from "../src/lib/chatAttachments.js";
import {
  completeLocalMentorTask,
  ensureLocalRewardTasks,
  claimLocalRewardTask
} from "../src/lib/progressRewardsRuntime.js";
import { REWARD_TASK_STATUS } from "../src/lib/rewardTaskCatalog.js";
import { canAccessFeature } from "../src/lib/planFeatures.js";

function installLocalStorage() {
  const store = new Map();
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => store.clear()
  };
  globalThis.localStorage = localStorage;
  globalThis.window = { localStorage };
}

describe("Progress Rewards mentor Complete → student Claim", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("lets an assigned mentor complete Mentor Meeting Completed", () => {
    const email = `rewards-meeting-${Date.now()}@example.com`;
    const tasks = ensureLocalRewardTasks(email);
    const meeting = tasks.find((t) => t.taskTemplateId === "mentor-meeting-completed");
    expect(meeting).toBeTruthy();
    const result = completeLocalMentorTask({
      studentEmail: email,
      taskInstanceId: meeting.id,
      mentorId: "mentor-1",
      isMainMentor: true
    });
    expect(result.error).toBeNull();
    expect(result.task.status).toBe(REWARD_TASK_STATUS.COMPLETED_BY_MENTOR);
  });

  it("rejects Complete from an unassigned mentor for Mentor Meeting Completed", () => {
    const email = `rewards-unassigned-${Date.now()}@example.com`;
    const tasks = ensureLocalRewardTasks(email);
    const meeting = tasks.find((t) => t.taskTemplateId === "mentor-meeting-completed");
    const blocked = completeLocalMentorTask({
      studentEmail: email,
      taskInstanceId: meeting.id,
      mentorId: "other-mentor",
      isMainMentor: false
    });
    expect(blocked.error).toMatch(/not assigned/i);
  });

  it("awards coins exactly once on Claim after mentor Complete", () => {
    const email = `rewards-claim-${Date.now()}@example.com`;
    const tasks = ensureLocalRewardTasks(email);
    const listStarted = tasks.find((t) => t.taskTemplateId === "admissions-college-list-started");
    completeLocalMentorTask({
      studentEmail: email,
      taskInstanceId: listStarted.id,
      mentorId: "mentor-1",
      isMainMentor: true
    });
    const first = claimLocalRewardTask(email, listStarted.id);
    expect(first.error).toBeNull();
    expect(first.wallet.coin_balance).toBeGreaterThan(0);
    const second = claimLocalRewardTask(email, listStarted.id);
    expect(second.error).toMatch(/already claimed/i);
  });
});

describe("Reward redemption chat preview", () => {
  it("renders a distinct preview for reward_redemption messages", () => {
    expect(
      chatMessagePreviewText({
        messageType: "reward_redemption",
        metadata: { rewardName: "Application Review" },
        body: "Reward redeemed: Application Review"
      })
    ).toBe("Reward redeemed: Application Review");
  });
});

describe("Rewards isolation from paid entitlements", () => {
  it("does not treat rewards access as Essay Support or session credits", () => {
    expect(canAccessFeature("plus", "rewards")).toBe(true);
    expect(canAccessFeature("basic", "rewards")).toBe(false);
  });
});
