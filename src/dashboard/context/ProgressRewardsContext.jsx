import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  MILESTONE_CATALOG,
  REWARD_CATALOG,
  applyCoinMultiplier,
  buildJordanDemoServices,
  buildSidebarProgress,
  countMilestonesToReward,
  enrichMilestones,
  enrichReward,
  filterMilestonesForStudent,
  getActiveServices,
  getClosestRewards,
  getCoinMultiplier,
  getCoinsToNextMultiplier,
  getCoinsToNextReward,
  getCurrentStatusMilestone,
  getFeaturedReward,
  getNextAffordableReward,
  getNextStatusTier,
  getStatusTier,
  getTierProgress,
  normalizeRewardsState,
  parseGradeLevel
} from "../lib/progressRewards.js";
import { resolveShopRewardIds } from "../lib/rewardShop.js";
import CoinCelebration from "../components/product/rewards/CoinCelebration.jsx";
import { useInteractionFeedback } from "../../components/interaction/InteractionFeedback.jsx";
import { useInterfaceSound } from "../../lib/sound/SoundProvider.jsx";

const ProgressRewardsContext = createContext(null);

function storageKey(email) {
  return `prelude-progress-rewards-${(email || "guest").toLowerCase()}`;
}

function shopStorageKey(email) {
  return `prelude-reward-shop-${(email || "guest").toLowerCase()}`;
}

export function ProgressRewardsProvider({ children, user, profile, initial }) {
  const normalizedInitial = normalizeRewardsState(initial);
  const [state, setState] = useState(normalizedInitial);
  const [toasts, setToasts] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [redemptionCelebration, setRedemptionCelebration] = useState(null);
  const [shopState, setShopState] = useState(() => resolveShopRewardIds({ storageKey: shopStorageKey(user?.email) }));
  const { triggerCoinBurst } = useInteractionFeedback();
  const { play, SOUND_EVENTS } = useInterfaceSound();

  useEffect(() => {
    if (!initial) return;
    const key = storageKey(user?.email);
    try {
      const saved = normalizeRewardsState(JSON.parse(localStorage.getItem(key) || "{}"));
      setState({
        coins: saved.coins ?? normalizedInitial.coins,
        completed: saved.completed.length ? saved.completed : normalizedInitial.completed,
        inProgress: saved.inProgress.length ? saved.inProgress : normalizedInitial.inProgress,
        inProgressProgress: { ...normalizedInitial.inProgressProgress, ...saved.inProgressProgress },
        redeemed: saved.redeemed,
        redemptionHistory: saved.redemptionHistory.length ? saved.redemptionHistory : normalizedInitial.redemptionHistory
      });
    } catch {
      setState(normalizedInitial);
    }
  }, [initial, user?.email]);

  useEffect(() => {
    const key = shopStorageKey(user?.email);
    const tick = () => {
      const next = resolveShopRewardIds({ storageKey: key });
      setShopState((prev) => (prev.periodKey !== next.periodKey ? next : prev));
    };
    tick();
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, [user?.email]);

  const persist = useCallback(
    (next) => {
      localStorage.setItem(
        storageKey(user?.email),
        JSON.stringify({
          coins: next.coins,
          completed: next.completed,
          inProgress: next.inProgress,
          inProgressProgress: next.inProgressProgress,
          redeemed: next.redeemed,
          redemptionHistory: next.redemptionHistory
        })
      );
    },
    [user?.email]
  );

  const showToast = useCallback((message, variant = "success") => {
    const id = `pr-toast-${Date.now()}`;
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const grade = parseGradeLevel(profile?.grade);
  const isJordan = user?.email === "student@prelude-demo.com";
  const studentFirstName = user?.name?.split(" ")[0] || profile?.firstName || "Your";
  const services = useMemo(
    () => (isJordan ? buildJordanDemoServices() : getActiveServices(profile)),
    [isJordan, profile]
  );

  const milestones = useMemo(() => {
    const filtered = filterMilestonesForStudent({ grade, services, catalog: MILESTONE_CATALOG });
    return enrichMilestones(filtered, state);
  }, [grade, services, state]);

  const completedCount = state.completed.length;
  const featuredRewardBase = getFeaturedReward();
  const featuredReward = useMemo(
    () => enrichReward(featuredRewardBase, state.coins, state.redeemed),
    [featuredRewardBase, state.coins, state.redeemed]
  );
  const nextReward = useMemo(() => getNextAffordableReward(state.coins, state.redeemed), [state.coins, state.redeemed]);
  const coinsToNext = getCoinsToNextReward(state.coins, featuredReward);
  const coinsToNextReward = getCoinsToNextReward(state.coins, nextReward);
  const milestonesToNext = countMilestonesToReward(state.coins, milestones, featuredReward);
  const currentTier = getStatusTier(state.coins);
  const nextTier = getNextStatusTier(state.coins);
  const tierProgress = getTierProgress(state.coins);
  const coinMultiplier = getCoinMultiplier(state.coins);
  const coinsToNextMultiplier = getCoinsToNextMultiplier(state.coins);
  const statusGoalCoins = nextTier?.coinsRequired ?? getCurrentStatusMilestone(state.coins).coinsRequired;
  const coinsToNextTier = getCoinsToNextMultiplier(state.coins);

  const completeMilestone = useCallback(
    (milestoneId) => {
      const def = MILESTONE_CATALOG.find((m) => m.id === milestoneId);
      if (!def || state.completed.includes(milestoneId)) return;

      const multiplier = getCoinMultiplier(state.coins);
      const earnedCoins = applyCoinMultiplier(def.coins, multiplier);
      const previousMilestone = getCurrentStatusMilestone(state.coins);
      const nextCoins = state.coins + earnedCoins;
      const newMilestone = getCurrentStatusMilestone(nextCoins);
      const unlockedMilestone = newMilestone.id !== previousMilestone.id ? newMilestone : null;

      setState((prev) => {
        const next = {
          ...prev,
          coins: prev.coins + earnedCoins,
          completed: [...prev.completed, milestoneId],
          inProgress: prev.inProgress.filter((id) => id !== milestoneId)
        };
        persist(next);
        return next;
      });

      setCelebration({
        milestoneId,
        title: def.title,
        coins: earnedCoins,
        variant: "milestone",
        unlockedMilestone
      });
      triggerCoinBurst(earnedCoins);
      play(SOUND_EVENTS.COIN_COLLECT);
      play(SOUND_EVENTS.REWARD_EARNED);
      setTimeout(() => setCelebration(null), 3200);

      if (unlockedMilestone) {
        showToast(`Status unlocked · ${unlockedMilestone.name} · ${unlockedMilestone.multiplier.toFixed(1)}x coin multiplier`, "success");
      } else {
        const rewardAfter = getNextAffordableReward(nextCoins, state.redeemed);
        showToast(
          `Milestone complete · +${earnedCoins} Coins${multiplier > 1 ? ` (${multiplier.toFixed(1)}x)` : ""} · You're one step closer to a ${rewardAfter.headline}.`
        );
      }
    },
    [persist, showToast, state.completed, state.redeemed, state.coins, triggerCoinBurst, play, SOUND_EVENTS]
  );

  const redeemReward = useCallback(
    (rewardId, options = {}) => {
      const reward = REWARD_CATALOG.find((r) => r.id === rewardId);
      if (!reward) return { success: false };

      if (state.redeemed.includes(rewardId)) {
        return { success: false, alreadyRedeemed: true };
      }

      if (state.coins < reward.coins) {
        return { success: false, coinsNeeded: reward.coins - state.coins };
      }

      if (reward.requiresSelection && !options.testPrepOption) {
        return { success: false, missingSelection: true };
      }

      const selectionLabel = options.testPrepOption ? ` (${options.testPrepOption})` : "";
      const historyEntry = {
        id: `redemption-${Date.now()}`,
        rewardId,
        title: `${reward.headline}${selectionLabel}`,
        status: "ready_to_schedule",
        redeemedAt: new Date().toISOString(),
        selection: options.testPrepOption || null
      };

      setState((prev) => {
        const next = {
          ...prev,
          coins: prev.coins - reward.coins,
          redeemed: [...prev.redeemed, rewardId],
          redemptionHistory: [historyEntry, ...prev.redemptionHistory]
        };
        persist(next);
        return next;
      });

      const enriched = enrichReward(reward, state.coins - reward.coins, [...state.redeemed, rewardId]);
      setRedemptionCelebration({
        tier: enriched.tier,
        title: reward.headline,
        coinsBalance: state.coins - reward.coins,
        goalCoins: featuredRewardBase.coins
      });
      play(SOUND_EVENTS.COIN_COLLECT);
      play(SOUND_EVENTS.REWARD_REDEEMED);
      setTimeout(() => setRedemptionCelebration(null), 3600);

      showToast("Reward redeemed! A mentor will follow up with next steps.", "success");
      return { success: true };
    },
    [persist, showToast, state.redeemed, state.coins, featuredRewardBase.coins, play, SOUND_EVENTS]
  );

  const handleRedeemReward = redeemReward;

  const rewards = useMemo(
    () => REWARD_CATALOG.map((r) => enrichReward(r, state.coins, state.redeemed)),
    [state.coins, state.redeemed]
  );

  const shopRewards = useMemo(
    () => shopState.rewardIds
      .map((id) => rewards.find((r) => r.id === id))
      .filter(Boolean),
    [shopState.rewardIds, rewards]
  );

  const closestRewards = useMemo(
    () => getClosestRewards(state.coins, state.redeemed),
    [state.coins, state.redeemed]
  );

  const sidebarProgress = useMemo(
    () => buildSidebarProgress(isJordan, state.coins, completedCount),
    [isJordan, state.coins, completedCount]
  );

  const value = useMemo(
    () => ({
      coins: state.coins,
      milestones,
      rewards,
      closestRewards,
      sidebarProgress,
      isJordan,
      featuredReward,
      redemptionHistory: state.redemptionHistory,
      completedCount,
      nextReward,
      coinsToNext,
      coinsToNextReward,
      milestonesToNext,
      currentTier,
      nextTier,
      tierProgress,
      coinsToNextTier,
      coinMultiplier,
      coinsToNextMultiplier,
      statusGoalCoins,
      shopRewards,
      shopRefreshAt: shopState.refreshAt,
      studentFirstName,
      grade,
      services,
      celebration,
      redemptionCelebration,
      completeMilestone,
      redeemReward,
      handleRedeemReward,
      showToast
    }),
    [
      state.coins,
      state.redemptionHistory,
      milestones,
      rewards,
      closestRewards,
      sidebarProgress,
      isJordan,
      featuredReward,
      completedCount,
      nextReward,
      coinsToNext,
      coinsToNextReward,
      milestonesToNext,
      currentTier,
      nextTier,
      tierProgress,
      coinsToNextTier,
      coinMultiplier,
      coinsToNextMultiplier,
      statusGoalCoins,
      shopRewards,
      shopState.refreshAt,
      studentFirstName,
      grade,
      services,
      celebration,
      redemptionCelebration,
      completeMilestone,
      redeemReward,
      handleRedeemReward,
      showToast
    ]
  );

  return (
    <ProgressRewardsContext.Provider value={value}>
      {children}
      {celebration ? (
        <CoinCelebration
          tier="uncommon"
          title={celebration.title}
          coins={celebration.coins}
          coinsBalance={state.coins}
          goalCoins={featuredReward.coins}
          variant="milestone"
        />
      ) : null}
      {redemptionCelebration ? (
        <CoinCelebration
          tier={redemptionCelebration.tier}
          title={redemptionCelebration.title}
          coinsBalance={redemptionCelebration.coinsBalance}
          goalCoins={redemptionCelebration.goalCoins}
          variant="redeem"
        />
      ) : null}
      <div className="dash-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`dash-toast dash-toast--${t.variant}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ProgressRewardsContext.Provider>
  );
}

export function useProgressRewards() {
  const ctx = useContext(ProgressRewardsContext);
  if (!ctx) throw new Error("useProgressRewards must be used inside ProgressRewardsProvider");
  return ctx;
}

export { buildDefaultProgressRewards } from "../lib/progressRewards.js";
