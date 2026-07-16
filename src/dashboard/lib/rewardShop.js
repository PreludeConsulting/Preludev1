/** Reward Shop rotation — daily (24h) + legendary featured (7d). */

import {
  LEGENDARY_REWARD_IDS,
  REWARD_CATALOG,
  REWARD_FULFILLMENT_TYPES,
  REWARD_SHOP_POOL_IDS,
  getRewardById
} from "./progressRewards.js";

export const SHOP_REFRESH_MS = 24 * 60 * 60 * 1000;
export const FEATURED_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
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

export function getFeaturedPeriodStart(now = Date.now()) {
  return Math.floor(now / FEATURED_REFRESH_MS) * FEATURED_REFRESH_MS;
}

export function getFeaturedRefreshAt(now = Date.now()) {
  return getFeaturedPeriodStart(now) + FEATURED_REFRESH_MS;
}

export function getFeaturedPeriodKey(now = Date.now()) {
  return String(getFeaturedPeriodStart(now));
}

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rankIds(ids, periodKey) {
  return [...ids].sort(
    (a, b) => hashString(`${periodKey}:${a}`) - hashString(`${periodKey}:${b}`)
  );
}

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

function hasSimilarPair(ids, catalogById) {
  const groups = new Map();
  for (const id of ids) {
    const group = catalogById.get(id)?.similarityGroup;
    if (!group || group === "live_academic") continue;
    if (groups.has(group)) return true;
    groups.set(group, id);
  }
  return false;
}

function partitionDailyPool(poolIds = REWARD_SHOP_POOL_IDS) {
  const asyncIds = [];
  const liveIds = [];
  for (const id of poolIds) {
    const reward = getRewardById(id);
    if (!reward || reward.active === false || reward.shopPool === "legendary") continue;
    if (reward.fulfillmentType === REWARD_FULFILLMENT_TYPES.LIVE_CALL) liveIds.push(id);
    else asyncIds.push(id);
  }
  return { asyncIds, liveIds };
}

/**
 * Select 3 daily shop rewards with constraints:
 * - unique
 * - ≥2 asynchronous application rewards
 * - ≤1 live SAT/ACT or tutoring reward
 * - no legendary
 * - avoid similar pairs when alternatives exist
 * - avoid repeating the previous period's exact set when possible
 */
export function selectShopRewardIds({
  pool = REWARD_SHOP_POOL_IDS,
  periodKey,
  count = SHOP_CARD_COUNT,
  previousIds = null,
  catalog = REWARD_CATALOG
} = {}) {
  const catalogById = new Map(catalog.map((r) => [r.id, r]));
  const { asyncIds, liveIds } = partitionDailyPool(pool);
  const rankedAsync = rankIds(asyncIds, periodKey);
  const rankedLive = rankIds(liveIds, periodKey);

  if (rankedAsync.length < 2) {
    return rankIds([...asyncIds, ...liveIds], periodKey).slice(0, count);
  }

  const includeLive = rankedLive.length > 0 && hashString(`live:${periodKey}`) % 3 === 0;
  const candidates = [];

  candidates.push(rankedAsync[0], rankedAsync[1]);

  if (includeLive) {
    candidates.push(rankedLive[0]);
  } else {
    const third = rankedAsync.find((id) => !candidates.includes(id));
    if (third) candidates.push(third);
  }

  if (hasSimilarPair(candidates, catalogById)) {
    const liveInSet = candidates.find((id) => liveIds.includes(id));
    const asyncInSet = candidates.filter((id) => asyncIds.includes(id));
    const replacement = rankedAsync.find((id) => {
      if (asyncInSet.includes(id)) return false;
      const group = catalogById.get(id)?.similarityGroup;
      return (
        group !== catalogById.get(asyncInSet[0])?.similarityGroup &&
        group !== catalogById.get(asyncInSet[1])?.similarityGroup
      );
    });
    if (replacement && asyncInSet.length >= 2) {
      let fixed = [asyncInSet[0], replacement];
      if (hasSimilarPair([...fixed, ...(liveInSet ? [liveInSet] : [])], catalogById)) {
        const alt = rankedAsync.find(
          (id) => !fixed.includes(id) && !hasSimilarPair([fixed[0], id], catalogById)
        );
        if (alt) fixed = [fixed[0], alt];
      }
      candidates.length = 0;
      candidates.push(...fixed);
      if (liveInSet) candidates.push(liveInSet);
      else {
        const fill = rankedAsync.find((id) => !candidates.includes(id));
        if (fill) candidates.push(fill);
      }
    }
  }

  let selected = candidates.slice(0, count);

  if (previousIds && sameSet(selected, previousIds)) {
    const altAsync = rankedAsync.filter((id) => !selected.includes(id));
    if (altAsync.length) {
      const swapIdx = selected.findIndex((id) => asyncIds.includes(id));
      if (swapIdx >= 0) {
        const attempt = [...selected];
        attempt[swapIdx] = altAsync[0];
        const liveCount = attempt.filter((id) => liveIds.includes(id)).length;
        const asyncCount = attempt.filter((id) => asyncIds.includes(id)).length;
        if (liveCount <= 1 && asyncCount >= 2 && !sameSet(attempt, previousIds)) {
          selected = attempt;
        }
      }
    } else if (rankedLive.length > 1 && selected.some((id) => liveIds.includes(id))) {
      const liveIdx = selected.findIndex((id) => liveIds.includes(id));
      const otherLive = rankedLive.find((id) => id !== selected[liveIdx]);
      if (otherLive && liveIdx >= 0) {
        const attempt = [...selected];
        attempt[liveIdx] = otherLive;
        if (!sameSet(attempt, previousIds)) selected = attempt;
      }
    }
  }

  const liveSelected = selected.filter((id) => liveIds.includes(id));
  const asyncSelected = selected.filter((id) => asyncIds.includes(id));
  if (liveSelected.length > 1) {
    selected = [...asyncSelected.slice(0, 2), liveSelected[0]].slice(0, count);
  }
  while (selected.filter((id) => asyncIds.includes(id)).length < 2 && rankedAsync.length) {
    const next = rankedAsync.find((id) => !selected.includes(id));
    if (!next) break;
    const liveIdx = selected.findIndex((id) => liveIds.includes(id));
    if (selected.length < count) selected.push(next);
    else if (liveIdx >= 0 && selected.filter((id) => asyncIds.includes(id)).length < 2) {
      selected[liveIdx] = next;
    } else break;
  }

  return selected.slice(0, count);
}

export function selectFeaturedRewardId({
  pool = LEGENDARY_REWARD_IDS,
  periodKey,
  previousId = null
} = {}) {
  const ranked = rankIds(pool, periodKey);
  if (!ranked.length) return null;
  let selected = ranked[hashString(`featured:${periodKey}`) % ranked.length];
  if (previousId && selected === previousId && ranked.length > 1) {
    selected = ranked.find((id) => id !== previousId) || selected;
  }
  return selected;
}

export function formatShopCountdown(msRemaining) {
  if (msRemaining <= 0) return "Refreshing now…";
  const totalMinutes = Math.floor(msRemaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `Refreshes in ${days}d ${remHours}h`;
  }
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

export function saveShopState(storageKey, state) {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      rewardShopLastRefresh: state.periodKey,
      rewardShopSelectedRewardIds: state.rewardIds,
      rewardShopRefreshAt: state.refreshAt,
      featuredPeriodKey: state.featuredPeriodKey,
      featuredRewardId: state.featuredRewardId,
      featuredRefreshAt: state.featuredRefreshAt,
      previousDailyIds: state.previousDailyIds || null,
      previousFeaturedId: state.previousFeaturedId || null
    })
  );
}

function idsAreValidDaily(ids) {
  if (!Array.isArray(ids) || ids.length !== SHOP_CARD_COUNT) return false;
  const pool = new Set(REWARD_SHOP_POOL_IDS);
  if (ids.some((id) => !pool.has(id))) return false;
  if (new Set(ids).size !== ids.length) return false;
  const { asyncIds, liveIds } = partitionDailyPool();
  const asyncCount = ids.filter((id) => asyncIds.includes(id)).length;
  const liveCount = ids.filter((id) => liveIds.includes(id)).length;
  return asyncCount >= 2 && liveCount <= 1;
}

/**
 * Resolve daily + featured offers.
 * Selection is deterministic from global period keys (same for all users).
 * localStorage only caches; invalid/stale catalogs are recomputed.
 */
export function resolveShopOffers({
  storageKey,
  pool = REWARD_SHOP_POOL_IDS,
  legendaryPool = LEGENDARY_REWARD_IDS,
  now = Date.now(),
  serverOffers = null
} = {}) {
  if (
    serverOffers?.rewardIds?.length === SHOP_CARD_COUNT &&
    serverOffers?.featuredRewardId &&
    serverOffers?.periodKey &&
    serverOffers?.featuredPeriodKey
  ) {
    return {
      rewardIds: serverOffers.rewardIds,
      periodKey: serverOffers.periodKey,
      refreshAt: serverOffers.refreshAt ?? getShopRefreshAt(now),
      featuredRewardId: serverOffers.featuredRewardId,
      featuredPeriodKey: serverOffers.featuredPeriodKey,
      featuredRefreshAt: serverOffers.featuredRefreshAt ?? getFeaturedRefreshAt(now),
      previousDailyIds: serverOffers.previousDailyIds || null,
      previousFeaturedId: serverOffers.previousFeaturedId || null,
      source: "server"
    };
  }

  const periodKey = getShopPeriodKey(now);
  const refreshAt = getShopRefreshAt(now);
  const featuredPeriodKey = getFeaturedPeriodKey(now);
  const featuredRefreshAt = getFeaturedRefreshAt(now);
  const saved = storageKey ? loadShopState(storageKey) : null;

  const dailyValid =
    saved?.rewardShopLastRefresh === periodKey &&
    idsAreValidDaily(saved?.rewardShopSelectedRewardIds);

  const featuredValid =
    saved?.featuredPeriodKey === featuredPeriodKey &&
    legendaryPool.includes(saved?.featuredRewardId);

  const previousDailyIds =
    saved?.rewardShopLastRefresh && saved.rewardShopLastRefresh !== periodKey
      ? saved.rewardShopSelectedRewardIds
      : saved?.previousDailyIds || null;

  const previousFeaturedId =
    saved?.featuredPeriodKey && saved.featuredPeriodKey !== featuredPeriodKey
      ? saved.featuredRewardId
      : saved?.previousFeaturedId || null;

  const rewardIds = dailyValid
    ? saved.rewardShopSelectedRewardIds
    : selectShopRewardIds({ pool, periodKey, previousIds: previousDailyIds });

  const featuredRewardId = featuredValid
    ? saved.featuredRewardId
    : selectFeaturedRewardId({
        pool: legendaryPool,
        periodKey: featuredPeriodKey,
        previousId: previousFeaturedId
      });

  const resolved = {
    rewardIds,
    periodKey,
    refreshAt: dailyValid ? (saved.rewardShopRefreshAt ?? refreshAt) : refreshAt,
    featuredRewardId,
    featuredPeriodKey,
    featuredRefreshAt: featuredValid ? (saved.featuredRefreshAt ?? featuredRefreshAt) : featuredRefreshAt,
    previousDailyIds: previousDailyIds || null,
    previousFeaturedId: previousFeaturedId || null,
    source: "local"
  };

  if (storageKey) saveShopState(storageKey, resolved);
  return resolved;
}

/** @deprecated use resolveShopOffers */
export function resolveShopRewardIds(options = {}) {
  const resolved = resolveShopOffers(options);
  return {
    rewardIds: resolved.rewardIds,
    periodKey: resolved.periodKey,
    refreshAt: resolved.refreshAt
  };
}
