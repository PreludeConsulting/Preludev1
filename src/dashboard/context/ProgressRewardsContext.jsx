import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  MILESTONE_CATALOG,
  REWARD_CATALOG,
  buildJordanDemoServices,
  buildSidebarProgress,
  countMilestonesToReward,
  enrichMilestones,
  filterMilestonesForStudent,
  getActiveServices,
  getClosestRewards,
  getCoinsToNextReward,
  getFeaturedReward,
  getNextAffordableReward,
  getNextStatusTier,
  getStatusTier,
  getTierProgress,
  normalizeRewardsState,
  parseGradeLevel
} from "../lib/progressRewards.js";
import PreludePiggyBank from "../components/product/rewards/PreludePiggyBank.jsx";

const ProgressRewardsContext = createContext(null);

function storageKey(email) {
  return `prelude-progress-rewards-${(email || "guest").toLowerCase()}`;
}

export function ProgressRewardsProvider({ children, user, profile, initial }) {
  const normalizedInitial = normalizeRewardsState(initial);
  const [state, setState] = useState(normalizedInitial);
  const [toasts, setToasts] = useState([]);
  const [celebration, setCelebration] = useState(null);

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
  const featuredReward = useMemo(() => {
    const r = featuredRewardBase;
    return {
      ...r,
      redeemed: state.redeemed.includes(r.id),
      canRedeem: state.coins >= r.coins && !state.redeemed.includes(r.id),
      coinsAway: Math.max(0, r.coins - state.coins),
      progressPct: Math.min(100, Math.round((state.coins / r.coins) * 100))
    };
  }, [featuredRewardBase, state.coins, state.redeemed]);
  const nextReward = useMemo(() => getNextAffordableReward(state.coins, state.redeemed), [state.coins, state.redeemed]);
  const coinsToNext = getCoinsToNextReward(state.coins, featuredReward);
  const coinsToNextReward = getCoinsToNextReward(state.coins, nextReward);
  const milestonesToNext = countMilestonesToReward(state.coins, milestones, featuredReward);
  const currentTier = getStatusTier(state.coins);
  const nextTier = getNextStatusTier(state.coins);
  const tierProgress = getTierProgress(state.coins);
  const coinsToNextTier = nextTier ? Math.max(0, nextTier.min - state.coins) : 0;

  const completeMilestone = useCallback(
    (milestoneId) => {
      const def = MILESTONE_CATALOG.find((m) => m.id === milestoneId);
      if (!def || state.completed.includes(milestoneId)) return;

      setState((prev) => {
        const next = {
          ...prev,
          coins: prev.coins + def.coins,
          completed: [...prev.completed, milestoneId],
          inProgress: prev.inProgress.filter((id) => id !== milestoneId)
        };
        persist(next);
        return next;
      });

      setCelebration({ milestoneId, title: def.title, coins: def.coins });
      setTimeout(() => setCelebration(null), 3200);

      const rewardAfter = getNextAffordableReward(state.coins + def.coins, state.redeemed);
      showToast(
        `Milestone complete · +${def.coins} Coins · You're one step closer to a ${rewardAfter.headline}.`
      );
    },
    [persist, showToast, state.completed, state.redeemed, state.coins]
  );

  const redeemReward = useCallback(
    (rewardId) => {
      const reward = REWARD_CATALOG.find((r) => r.id === rewardId);
      if (!reward || state.redeemed.includes(rewardId) || state.coins < reward.coins) return false;

      const historyEntry = {
        id: `redemption-${Date.now()}`,
        rewardId,
        title: reward.headline,
        status: "ready_to_schedule",
        redeemedAt: new Date().toISOString()
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

      showToast(`${reward.headline} redeemed — we'll schedule this on your account shortly.`);
      return true;
    },
    [persist, showToast, state.redeemed, state.coins]
  );

  const rewards = useMemo(
    () => REWARD_CATALOG.map((r) => ({
      ...r,
      redeemed: state.redeemed.includes(r.id),
      canRedeem: state.coins >= r.coins && !state.redeemed.includes(r.id),
      coinsAway: Math.max(0, r.coins - state.coins),
      progressPct: Math.min(100, Math.round((state.coins / r.coins) * 100))
    })),
    [state.coins, state.redeemed]
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
      studentFirstName,
      grade,
      services,
      celebration,
      completeMilestone,
      redeemReward,
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
      studentFirstName,
      grade,
      services,
      celebration,
      completeMilestone,
      redeemReward,
      showToast
    ]
  );

  return (
    <ProgressRewardsContext.Provider value={value}>
      {children}
      {celebration ? (
        <div className="dash-rewards-celebration" role="status" aria-live="polite">
          <div className="dash-rewards-celebration__coins" aria-hidden="true">
            <span className="dash-rewards-celebration__coin dash-rewards-celebration__coin--one" />
            <span className="dash-rewards-celebration__coin dash-rewards-celebration__coin--two" />
            <span className="dash-rewards-celebration__coin dash-rewards-celebration__coin--three" />
          </div>
          <div className="dash-rewards-celebration__card">
            <PreludePiggyBank size="sm" animate />
            <p className="dash-rewards-celebration__eyebrow">Milestone complete</p>
            <p className="dash-rewards-celebration__title">{celebration.title}</p>
            <p className="dash-rewards-celebration__coins-label">+{celebration.coins} Prelude Coins</p>
            <p className="dash-rewards-celebration__hint">Coins added to your Piggy Bank</p>
          </div>
        </div>
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
