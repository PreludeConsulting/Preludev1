/** 24-hour rotating Reward Shop selection logic. */

import { FEATURED_REWARD_ID, REWARD_SHOP_POOL_IDS } from "./progressRewards.js";

export const SHOP_REFRESH_MS = 24 * 60 * 60 * 1000;
export const SHOP_CARD_COUNT = 3;

export function getShopPeriodStart(now = Date.now()) {
  return Math.floor(now / SHOP_REFRESH_MS) * SHOP_REFRESH_MS;
}

export function getShopRefreshAt(now = Date.now()) {
  return getShopPeriodStart(now) + SHOP_REFRESH_MS;
}

export function getShopPeriodKey(now = Date.now()) {
  return String(getShopPeriodStart(now));
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Deterministic daily selection — stable within each 24h period. */
export function selectShopRewardIds({
  pool = REWARD_SHOP_POOL_IDS,
  periodKey,
  count = SHOP_CARD_COUNT,
  excludeIds = [FEATURED_REWARD_ID]
} = {}) {
  const available = pool.filter((id) => !excludeIds.includes(id));
  const ranked = [...available].sort(
    (a, b) => hashString(`${periodKey}:${a}`) - hashString(`${periodKey}:${b}`)
  );
  return ranked.slice(0, Math.min(count, ranked.length));
}

export function formatShopCountdown(msRemaining) {
  if (msRemaining <= 0) return "Refreshing now…";
  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `Refreshes in ${hours}h ${minutes}m`;
  if (minutes >= 1) return `Refreshes in ${minutes}m`;
  return "Refreshes soon";
}

export function loadShopState(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveShopState(storageKey, { periodKey, rewardIds, refreshAt }) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      rewardShopLastRefresh: periodKey,
      rewardShopSelectedRewardIds: rewardIds,
      rewardShopRefreshAt: refreshAt
    })
  );
}

export function resolveShopRewardIds({
  storageKey,
  pool = REWARD_SHOP_POOL_IDS,
  now = Date.now()
} = {}) {
  const periodKey = getShopPeriodKey(now);
  const refreshAt = getShopRefreshAt(now);
  const saved = loadShopState(storageKey);

  if (
    saved?.rewardShopLastRefresh === periodKey &&
    Array.isArray(saved.rewardShopSelectedRewardIds) &&
    saved.rewardShopSelectedRewardIds.length === SHOP_CARD_COUNT
  ) {
    return {
      rewardIds: saved.rewardShopSelectedRewardIds,
      periodKey,
      refreshAt: saved.rewardShopRefreshAt ?? refreshAt
    };
  }

  const rewardIds = selectShopRewardIds({ pool, periodKey });
  saveShopState(storageKey, { periodKey, rewardIds, refreshAt });
  return { rewardIds, periodKey, refreshAt };
}
