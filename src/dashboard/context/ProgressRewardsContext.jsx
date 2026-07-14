import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDashboardData } from "./DashboardDataContext.jsx";
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
  formatStatusProgressCopy,
  getActiveServices,
  getCheapestRewardTarget,
  getClosestRewards,
  getCoinMultiplier,
  getStatusCoinMultiplier,
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
import {
  claimRewardTask,
  completeMentorControlledRewardTask,
  ensureRewardTaskInstances,
  getRewardWallet,
  grantRewardsWelcomeBonus,
  isMainMentorForStudent,
  listRewardRedemptions,
  listRewardTaskInstances,
  redeemCatalogReward,
  syncDashboardControlledRewardTasks,
  syncStudentNetworkMessageActivity
} from "../../lib/dashboardData.js";
import {
  claimLocalRewardTask,
  completeLocalMentorTask,
  ensureLocalRewardTasks,
  grantLocalWelcomeBonus,
  loadLocalRewardWallet
} from "../../lib/progressRewardsRuntime.js";
import { canAccessFeature, getUserPlan } from "../../lib/planFeatures.js";
import {
  EARN_CATEGORY_ORDER,
  MILESTONE_CATEGORY_LABELS,
  REWARD_TASK_OWNERSHIP,
  REWARD_TASK_STATUS,
  getRecommendedEarnAction,
  getTaskDefinition
} from "../../lib/rewardTaskCatalog.js";
import { resolveShopRewardIds } from "../lib/rewardShop.js";
import CoinCelebration from "../components/product/rewards/CoinCelebration.jsx";
import { useInteractionFeedback } from "../../components/interaction/InteractionFeedback.jsx";
import { useInterfaceSound } from "../../lib/sound/SoundProvider.jsx";
import { isJordanDemoEmail } from "../../data/demoAccounts.js";
import { buildRewardsSnapshot, buildSidebarProgressFromSnapshot } from "../lib/rewardsSnapshot.js";
import { createSyncState, SYNC_STATUS } from "../lib/dataSyncState.js";
import DataSyncBanner from "../components/DataSyncBanner.jsx";

const ProgressRewardsContext = createContext(null);

function storageKey(email) {
  return `prelude-progress-rewards-${(email || "guest").toLowerCase()}`;
}

function shopStorageKey(email) {
  return `prelude-reward-shop-${(email || "guest").toLowerCase()}`;
}

export function ProgressRewardsProvider({ children, user, profile, initial }) {
  const { isMentorStudentView, mentor: assignedMentor } = useDashboardData();
  const { user: authUser } = useAuth();
  const [state, setState] = useState(() => normalizeRewardsState(initial));
  const [toasts, setToasts] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [redemptionCelebration, setRedemptionCelebration] = useState(null);
  const [shopState, setShopState] = useState(() => resolveShopRewardIds({ storageKey: shopStorageKey(user?.email) }));
  const [tasks, setTasks] = useState([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncState, setSyncState] = useState(() => createSyncState());
  const [rewardsSnapshot, setRewardsSnapshot] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const { triggerCoinBurst } = useInteractionFeedback();
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const planId = getUserPlan(user);
  // Plus/Pro include flexible session credits for SAT/ACT and tutoring reward tracks.
  const satActUnlocked = Boolean(profile?.satActPrep) || canAccessFeature(planId, "satActPrep");
  const tutoringUnlocked = Boolean(profile?.academicTutoring) || canAccessFeature(planId, "academicTutoring");
  const proBoost = canAccessFeature(planId, "advancedRewards");
  const isSupabaseUser = user?.authProvider === "supabase";
  const usesTaskRuntime = isSupabaseUser || isMentorStudentView || Boolean(user?.email);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // Rehydrate only when the signed-in student changes — never on every parent render.
  useEffect(() => {
    const source = initialRef.current;
    if (!source) return;
    const next = normalizeRewardsState(source);
    if (isSupabaseUser) {
      setState(next);
      return;
    }
    const key = storageKey(user?.email);
    try {
      const saved = normalizeRewardsState(JSON.parse(localStorage.getItem(key) || "{}"));
      setState({
        coins: saved.coins ?? next.coins,
        completed: saved.completed.length ? saved.completed : next.completed,
        inProgress: saved.inProgress.length ? saved.inProgress : next.inProgress,
        inProgressProgress: { ...next.inProgressProgress, ...saved.inProgressProgress },
        redeemed: saved.redeemed,
        redemptionHistory: saved.redemptionHistory.length ? saved.redemptionHistory : next.redemptionHistory
      });
    } catch {
      setState(next);
    }
  }, [isSupabaseUser, user?.email]);

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

  const [isMainAssignedMentor, setIsMainAssignedMentor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveMainMentor() {
      if (!isMentorStudentView || !authUser?.id) {
        setIsMainAssignedMentor(false);
        return;
      }
      if (!isSupabaseUser) {
        setIsMainAssignedMentor(
          assignedMentor?.id === authUser.id || assignedMentor?.email === authUser.email
        );
        return;
      }
      if (!user?.id) {
        setIsMainAssignedMentor(false);
        return;
      }
      const { isMain } = await isMainMentorForStudent(authUser.id, user.id);
      if (!cancelled) setIsMainAssignedMentor(Boolean(isMain));
    }
    resolveMainMentor().catch(() => {
      if (!cancelled) setIsMainAssignedMentor(false);
    });
    return () => {
      cancelled = true;
    };
  }, [assignedMentor?.email, assignedMentor?.id, authUser?.email, authUser?.id, isMentorStudentView, isSupabaseUser, user?.id]);

  const refreshRewardTasks = useCallback(async () => {
    if (!user?.id && !user?.email) return;
    if (isSupabaseUser && user?.id) {
      const [{ tasks: rows }, { wallet }, { redemptions, error: redemptionError }] = await Promise.all([
        listRewardTaskInstances(user.id),
        getRewardWallet(user.id),
        listRewardRedemptions(user.id)
      ]);
      const mappedTasks = rows || [];
      setTasks(mappedTasks);
      const snapshot = buildRewardsSnapshot({
        wallet,
        tasks: mappedTasks,
        redemptions,
        redemptionHistory: []
      });
      setRewardsSnapshot(snapshot);
      setState((prev) => ({
        ...prev,
        coins: snapshot.coins,
        lifetimeCoins: snapshot.lifetimeCoins,
        redeemed: snapshot.redeemedIds,
        redemptionHistory: snapshot.redemptionHistory
      }));
      if (redemptionError) {
        setSyncError(redemptionError);
        setSyncState(createSyncState({ status: SYNC_STATUS.FAILED, error: redemptionError, source: "rewards" }));
      } else {
        setSyncError(null);
        setSyncState(createSyncState({ status: SYNC_STATUS.SAVED, lastSyncedAt: snapshot.syncedAt, source: "rewards" }));
      }
      return;
    }
    const localTasks = ensureLocalRewardTasks(user.email, { satActUnlocked, tutoringUnlocked });
    const wallet = loadLocalRewardWallet(user.email);
    setTasks(localTasks);
    setState((prev) => ({
      ...prev,
      coins: Number(wallet.coin_balance || prev.coins || 0),
      lifetimeCoins: Number(wallet.lifetime_coins || wallet.lifetime_earned || prev.lifetimeCoins || 0)
    }));
    setSyncError(null);
  }, [isSupabaseUser, satActUnlocked, tutoringUnlocked, user?.email, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadRewardTasks() {
      if (!usesTaskRuntime || (!user?.id && !user?.email)) return;
      setSyncLoading(true);
      setSyncState(createSyncState({ status: SYNC_STATUS.LOADING, source: "rewards" }));
      try {
        if (isSupabaseUser && user?.id) {
          await ensureRewardTaskInstances(user.id, { satActUnlocked, tutoringUnlocked });
          if (!isMentorStudentView) {
            await syncStudentNetworkMessageActivity(user.id);
            await syncDashboardControlledRewardTasks(user.id);
          }
        } else if (user?.email) {
          ensureLocalRewardTasks(user.email, { satActUnlocked, tutoringUnlocked });
        }
        if (cancelled) return;
        await refreshRewardTasks();
      } catch (err) {
        if (!cancelled) {
          setSyncState(createSyncState({
            status: SYNC_STATUS.FAILED,
            error: err?.message || "Could not sync rewards.",
            source: "rewards"
          }));
        }
      } finally {
        if (!cancelled) setSyncLoading(false);
      }
    }
    loadRewardTasks().catch(() => {
      if (!cancelled) {
        setSyncLoading(false);
        setSyncError("Rewards could not be synchronized.");
        setSyncState(createSyncState({ status: SYNC_STATUS.FAILED, error: "Could not sync rewards.", source: "rewards" }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isMentorStudentView, isSupabaseUser, refreshRewardTasks, satActUnlocked, tutoringUnlocked, user?.email, user?.id, usesTaskRuntime]);

  const persist = useCallback(
    (next) => {
      if (isSupabaseUser) return;
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
    [isSupabaseUser, user?.email]
  );

  const showToast = useCallback((message, variant = "success") => {
    const id = `pr-toast-${Date.now()}`;
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function grantWelcome() {
      if (isMentorStudentView) return;
      const plan = getUserPlan(user);
      if (!canAccessFeature(plan, "rewards")) return;
      if (isSupabaseUser && user?.id) {
        const bonus = await grantRewardsWelcomeBonus(user.id);
        if (cancelled || !bonus?.granted) return;
        showToast(`${bonus.label || "Welcome Bonus"}: +${bonus.amount} coins.`);
        await refreshRewardTasks();
        return;
      }
      if (user?.email) {
        const bonus = grantLocalWelcomeBonus(user.email);
        if (cancelled || !bonus?.granted) return;
        showToast(`${bonus.label || "Welcome Bonus"}: +${bonus.amount} coins.`);
        await refreshRewardTasks();
      }
    }
    grantWelcome().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isMentorStudentView, isSupabaseUser, refreshRewardTasks, showToast, user]);

  const grade = parseGradeLevel(profile?.grade);
  const isJordan = isJordanDemoEmail(user?.email);
  const studentFirstName = user?.name?.split(" ")[0] || profile?.firstName || "Your";
  const services = useMemo(
    () => (isJordan ? buildJordanDemoServices() : getActiveServices(profile)),
    [isJordan, profile]
  );

  const milestones = useMemo(() => {
    if (usesTaskRuntime && tasks.length) {
      return tasks.map((task) => ({
        id: task.id,
        taskTemplateId: task.taskTemplateId,
        category: task.category,
        title: task.title || getTaskDefinition(task.taskTemplateId)?.title || "Reward task",
        coins: task.coins || getTaskDefinition(task.taskTemplateId)?.coins || 0,
        status: task.status,
        ownershipType: task.ownership,
        progress: task.progressTarget ? Math.min(100, Math.round((task.progressCurrent / task.progressTarget) * 100)) : 0,
        progressCurrent: task.progressCurrent || 0,
        progressTarget: task.progressTarget || 1,
        locked: task.status === REWARD_TASK_STATUS.LOCKED,
        claimable:
          task.status === REWARD_TASK_STATUS.READY_TO_CLAIM ||
          task.status === REWARD_TASK_STATUS.COMPLETED_BY_MENTOR
      }));
    }
    const filtered = filterMilestonesForStudent({ grade, services, catalog: MILESTONE_CATALOG });
    return enrichMilestones(filtered, state);
  }, [grade, services, state, tasks, usesTaskRuntime]);

  const completedCount = useMemo(
    () => milestones.filter((m) => m.status === REWARD_TASK_STATUS.CLAIMED).length,
    [milestones]
  );
  const featuredRewardBase = getFeaturedReward();
  const featuredReward = useMemo(
    () => enrichReward(featuredRewardBase, state.coins, state.redeemed),
    [featuredRewardBase, state.coins, state.redeemed]
  );
  const nextReward = useMemo(() => getNextAffordableReward(state.coins, state.redeemed), [state.coins, state.redeemed]);
  const coinsToNext = getCoinsToNextReward(state.coins, featuredReward);
  const coinsToNextReward = getCoinsToNextReward(state.coins, nextReward);
  const milestonesToNext = countMilestonesToReward(state.coins, milestones, featuredReward);
  const lifetimeCoins = Number(state.lifetimeCoins || 0);
  const currentTier = getStatusTier(lifetimeCoins);
  const nextTier = getNextStatusTier(lifetimeCoins);
  const tierProgress = getTierProgress(lifetimeCoins);
  const coinMultiplier = getCoinMultiplier(lifetimeCoins, { proBoost });
  const statusCoinMultiplier = getStatusCoinMultiplier(lifetimeCoins);
  const coinsToNextMultiplier = getCoinsToNextMultiplier(lifetimeCoins);
  const statusGoalCoins = nextTier?.coinsRequired ?? getCurrentStatusMilestone(lifetimeCoins).coinsRequired;
  const coinsToNextTier = getCoinsToNextMultiplier(lifetimeCoins);
  const statusProgressCopy = formatStatusProgressCopy(lifetimeCoins);
  const recommendedStatusAction = getRecommendedEarnAction(statusProgressCopy.coinsNeeded || 0, coinMultiplier, {
    satActUnlocked,
    tutoringUnlocked
  });
  const nextRewardTarget = getCheapestRewardTarget(state.coins, state.redeemed);
  const piggyGoalCoins = nextRewardTarget?.goalCoins || 60;
  const piggyProgressLabel = nextRewardTarget?.label || `${state.coins} / ${piggyGoalCoins} coins until first reward`;
  const piggyCanRedeem = Boolean(nextRewardTarget?.canRedeem);

  const canMentorCompleteTask = useCallback(
    (milestone) => {
      if (!isMentorStudentView || !authUser?.id) return false;
      if (milestone.ownershipType !== REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED) return false;
      if (milestone.locked) return false;
      if ([REWARD_TASK_STATUS.CLAIMED, REWARD_TASK_STATUS.COMPLETED_BY_MENTOR, REWARD_TASK_STATUS.READY_TO_CLAIM].includes(milestone.status)) {
        return false;
      }
      if (milestone.taskTemplateId === "mentor-meeting-completed" && !isMainAssignedMentor) {
        return false;
      }
      return true;
    },
    [authUser?.id, isMainAssignedMentor, isMentorStudentView]
  );

  const completeMilestone = useCallback(
    async (milestoneId) => {
      const milestone = milestones.find((item) => item.id === milestoneId);
      if (!milestone) return;
      if (!isMentorStudentView) return;
      if (milestone.ownershipType === REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED) return;
      if (!canMentorCompleteTask(milestone)) {
        if (milestone.taskTemplateId === "mentor-meeting-completed" && !isMainAssignedMentor) {
          showToast("Only the student's main assigned mentor can complete this task.", "error");
        }
        return;
      }

      if (isSupabaseUser && authUser?.id && user?.id) {
        const result = await completeMentorControlledRewardTask(authUser.id, user.id, milestoneId);
        if (result?.error) {
          showToast(result.error, "error");
          return;
        }
        await refreshRewardTasks();
        showToast("Task marked ready for the student to claim.");
        return;
      }

      const result = completeLocalMentorTask({
        studentEmail: user?.email,
        taskInstanceId: milestoneId,
        mentorId: authUser?.id || "mentor",
        isMainMentor: isMainAssignedMentor
      });
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      await refreshRewardTasks();
      showToast("Task marked ready for the student to claim.");
    },
    [
      authUser?.id,
      canMentorCompleteTask,
      isMainAssignedMentor,
      isMentorStudentView,
      isSupabaseUser,
      milestones,
      refreshRewardTasks,
      showToast,
      user?.email,
      user?.id
    ]
  );

  const claimMilestone = useCallback(
    async (milestoneId) => {
      if (isMentorStudentView) return;
      if (!user?.id && !user?.email) return;

      if (isSupabaseUser && user?.id) {
        const { task, wallet, error } = await claimRewardTask(user.id, milestoneId, { proBoost });
        if (error) {
          showToast(error, "error");
          return;
        }
        if (!task) return;
        setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
        if (wallet) {
          setState((prev) => ({
            ...prev,
            coins: Number(wallet.coin_balance || prev.coins),
            lifetimeCoins: Number(wallet.lifetime_coins ?? wallet.lifetime_earned ?? prev.lifetimeCoins)
          }));
        }
        triggerCoinBurst(task.coins || 0);
        play(SOUND_EVENTS.COIN_COLLECT);
        play(SOUND_EVENTS.REWARD_EARNED);
        showToast(`Claimed +${task.coins || 0} coins.`);
        await ensureRewardTaskInstances(user.id, { satActUnlocked, tutoringUnlocked });
        await refreshRewardTasks();
        return;
      }

      const { task, wallet, error } = claimLocalRewardTask(user.email, milestoneId, {
        satActUnlocked,
        tutoringUnlocked,
        proBoost
      });
      if (error) {
        showToast(error, "error");
        return;
      }
      if (wallet) {
        setState((prev) => ({
          ...prev,
          coins: Number(wallet.coin_balance || prev.coins),
          lifetimeCoins: Number(wallet.lifetime_coins ?? wallet.lifetime_earned ?? prev.lifetimeCoins)
        }));
      }
      if (task) {
        triggerCoinBurst(task.coins || 0);
        play(SOUND_EVENTS.COIN_COLLECT);
        play(SOUND_EVENTS.REWARD_EARNED);
        showToast(`Claimed +${task.coins || 0} coins.`);
      }
      await refreshRewardTasks();
    },
    [
      isMentorStudentView,
      isSupabaseUser,
      play,
      proBoost,
      refreshRewardTasks,
      satActUnlocked,
      showToast,
      triggerCoinBurst,
      tutoringUnlocked,
      user?.email,
      user?.id,
      SOUND_EVENTS.COIN_COLLECT,
      SOUND_EVENTS.REWARD_EARNED
    ]
  );

  const redeemReward = useCallback(
    async (rewardId, options = {}) => {
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

      if (isSupabaseUser && user?.id) {
        const { redemption, wallet, error, alreadyRedeemed } = await redeemCatalogReward(user.id, {
          rewardId,
          selection: options.testPrepOption || null
        });
        if (error) {
          showToast(error, "error");
          return { success: false, alreadyRedeemed, error };
        }
        const nextCoins = Number(wallet?.coin_balance ?? state.coins - reward.coins);
        setState((prev) => ({
          ...prev,
          coins: nextCoins,
          redeemed: [...prev.redeemed, rewardId],
          redemptionHistory: [redemption || historyEntry, ...prev.redemptionHistory]
        }));
        await refreshRewardTasks();
      } else {
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
      }

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
    [
      featuredRewardBase.coins,
      isSupabaseUser,
      persist,
      play,
      refreshRewardTasks,
      showToast,
      state.coins,
      state.redeemed,
      user?.id,
      SOUND_EVENTS.COIN_COLLECT,
      SOUND_EVENTS.REWARD_REDEEMED
    ]
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

  const sidebarProgress = useMemo(() => {
    if (rewardsSnapshot) return buildSidebarProgressFromSnapshot(rewardsSnapshot);
    if (usesTaskRuntime && tasks.length) {
      return buildSidebarProgressFromSnapshot(buildRewardsSnapshot({
        wallet: { coin_balance: state.coins },
        tasks,
        redemptions: [],
        redemptionHistory: state.redemptionHistory
      }));
    }
    return buildSidebarProgress(isJordan, state.coins, completedCount, {
      currentStreak: tasks.find((task) => task.taskTemplateId === "momentum-7-day-login-streak")?.progressCurrent || 0,
      meetingsCompleted: tasks.filter((task) => task.taskTemplateId === "mentor-meeting-completed" && task.status === REWARD_TASK_STATUS.CLAIMED).length
    });
  }, [completedCount, isJordan, rewardsSnapshot, state.coins, state.redemptionHistory, tasks, usesTaskRuntime]);

  const value = useMemo(
    () => ({
      coins: state.coins,
      lifetimeCoins,
      milestones,
      rewards,
      closestRewards,
      sidebarProgress,
      syncLoading,
      syncState,
      rewardsSnapshot,
      syncError,
      retrySync: refreshRewardTasks,
      earnCategoryOrder: EARN_CATEGORY_ORDER,
      milestoneCategoryLabels: MILESTONE_CATEGORY_LABELS,
      claimMilestone,
      isMentorStudentView,
      canMentorCompleteTask,
      isMainAssignedMentor,
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
      statusCoinMultiplier,
      proBoost,
      coinsToNextMultiplier,
      statusGoalCoins,
      statusProgressCopy,
      recommendedStatusAction,
      nextRewardTarget,
      piggyGoalCoins,
      piggyProgressLabel,
      piggyCanRedeem,
      shopRewards,
      shopRefreshAt: shopState.refreshAt,
      studentFirstName,
      grade,
      services,
      celebration,
      redemptionCelebration,
      completeMilestone,
      claimMilestone,
      redeemReward,
      handleRedeemReward,
      showToast
    }),
    [
      state.coins,
      lifetimeCoins,
      state.redemptionHistory,
      milestones,
      rewards,
      closestRewards,
      sidebarProgress,
      syncLoading,
      syncState,
      rewardsSnapshot,
      syncError,
      refreshRewardTasks,
      isMentorStudentView,
      canMentorCompleteTask,
      isMainAssignedMentor,
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
      statusCoinMultiplier,
      proBoost,
      coinsToNextMultiplier,
      statusGoalCoins,
      statusProgressCopy,
      recommendedStatusAction,
      nextRewardTarget,
      piggyGoalCoins,
      piggyProgressLabel,
      piggyCanRedeem,
      shopRewards,
      shopState.refreshAt,
      studentFirstName,
      grade,
      services,
      celebration,
      redemptionCelebration,
      completeMilestone,
      claimMilestone,
      redeemReward,
      handleRedeemReward,
      showToast
    ]
  );

  return (
    <ProgressRewardsContext.Provider value={value}>
      <DataSyncBanner syncState={syncState.status === SYNC_STATUS.FAILED ? syncState : null} />
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
