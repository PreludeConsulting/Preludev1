import { describe, expect, it } from "vitest";
import {
  LEGENDARY_REWARD_IDS,
  REWARD_CATALOG,
  REWARD_FULFILLMENT_TYPES,
  REWARD_SHOP_POOL_IDS,
  RETIRED_REWARD_IDS
} from "../src/dashboard/lib/progressRewards.js";
import {
  SHOP_CARD_COUNT,
  selectFeaturedRewardId,
  selectShopRewardIds
} from "../src/dashboard/lib/rewardShop.js";

describe("rewards catalog v3", () => {
  it("exposes 10 daily and 4 legendary active rewards without FREE titles", () => {
    const daily = REWARD_CATALOG.filter((r) => r.shopPool === "daily");
    const legendary = REWARD_CATALOG.filter((r) => r.shopPool === "legendary");
    expect(daily).toHaveLength(10);
    expect(legendary).toHaveLength(4);
    expect(REWARD_SHOP_POOL_IDS).toHaveLength(10);
    expect(LEGENDARY_REWARD_IDS).toHaveLength(4);
    for (const reward of REWARD_CATALOG) {
      expect(reward.title.startsWith("FREE ")).toBe(false);
      expect(reward.headline.startsWith("FREE ")).toBe(false);
      expect(reward.active).toBe(true);
    }
    expect(RETIRED_REWARD_IDS).toContain("essay-review-session");
    expect(RETIRED_REWARD_IDS).toContain("bonus-flexible-session");
  });

  it("keeps college-consulting and micro-review style rewards out of the active catalog", () => {
    const blob = JSON.stringify(REWARD_CATALOG);
    expect(blob).not.toMatch(/college-consulting/i);
    expect(blob).not.toMatch(/strategy call/i);
    expect(blob).not.toMatch(/worksheet|template|checklist|downloadable/i);
    expect(blob).not.toMatch(/one paragraph|one activity description/i);
    expect(blob).not.toMatch(/priority.?response|turnaround/i);
  });
});

describe("reward shop rotation rules", () => {
  it("selects three unique daily rewards with async majority and at most one live", () => {
    const periods = ["1000", "2000", "3000", "4000", "5000", "86400000", "172800000"];
    for (const periodKey of periods) {
      const ids = selectShopRewardIds({ periodKey });
      expect(ids).toHaveLength(SHOP_CARD_COUNT);
      expect(new Set(ids).size).toBe(SHOP_CARD_COUNT);
      expect(ids.every((id) => REWARD_SHOP_POOL_IDS.includes(id))).toBe(true);
      expect(ids.some((id) => LEGENDARY_REWARD_IDS.includes(id))).toBe(false);

      const rewards = ids.map((id) => REWARD_CATALOG.find((r) => r.id === id));
      const asyncCount = rewards.filter((r) => r.fulfillmentType === REWARD_FULFILLMENT_TYPES.ASYNC_WRITTEN).length;
      const liveCount = rewards.filter((r) => r.fulfillmentType === REWARD_FULFILLMENT_TYPES.LIVE_CALL).length;
      expect(asyncCount).toBeGreaterThanOrEqual(2);
      expect(liveCount).toBeLessThanOrEqual(1);
    }
  });

  it("avoids repeating the previous exact set when alternatives exist", () => {
    const first = selectShopRewardIds({ periodKey: "period-a" });
    const second = selectShopRewardIds({ periodKey: "period-b", previousIds: first });
    expect(second).toHaveLength(3);
    expect([...second].sort().join(",")).not.toBe([...first].sort().join(","));
  });

  it("rotates featured rewards only through the legendary pool", () => {
    const periods = ["1000", "2000", "3000", "4000", "5000", "6000", "7000", "8000"];
    const seen = new Set();
    for (const periodKey of periods) {
      const id = selectFeaturedRewardId({ periodKey });
      expect(LEGENDARY_REWARD_IDS).toContain(id);
      seen.add(id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
