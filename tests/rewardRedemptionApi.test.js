import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: null }));
vi.mock("../src/lib/supabase.js", () => ({ getSupabase: () => mocks.client }));

import { listRewardRedemptions, redeemCatalogReward } from "../src/lib/dashboardData.js";

describe("reward redemption Supabase boundary", () => {
  beforeEach(() => {
    mocks.client = null;
  });

  it("uses the atomic RPC without accepting client-owned cost or title", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        redemption: {
          id: "redemption-1",
          reward_id: "essay-review-session",
          title: "FREE Essay Review Session",
          coin_cost: 300,
          status: "ready_to_schedule",
          selection: null,
          redeemed_at: "2026-07-11T12:00:00.000Z"
        },
        wallet: { user_id: "user-1", coin_balance: 200 }
      },
      error: null
    });
    mocks.client = { rpc };

    const result = await redeemCatalogReward("user-1", {
      rewardId: "essay-review-session",
      selection: null,
      title: "forged title",
      coinCost: 1
    });

    expect(rpc).toHaveBeenCalledWith("redeem_catalog_reward", {
      p_reward_id: "essay-review-session",
      p_selection: null
    });
    expect(result.wallet.coin_balance).toBe(200);
    expect(result.redemption.coinCost).toBe(300);
  });

  it("returns a retry message instead of a raw schema-cache error", async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Could not find the table public.reward_redemptions in the schema cache" }
      })
    };
    mocks.client = { from: vi.fn(() => chain) };

    const result = await listRewardRedemptions("user-1");
    expect(result.redemptions).toEqual([]);
    expect(result.error).toBe("Rewards are temporarily unavailable. Retry in a moment.");
    expect(result.error).not.toContain("schema cache");
  });
});
