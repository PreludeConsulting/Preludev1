import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDashboardData } from "./DashboardDataContext.jsx";
import {
  MILESTONE_CATALOG,
  REWARD_CATALOG,
  applyCoinMultiplier,
  buildJordanDemoServices,
  buildRewardCatalogSnapshot,
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
  getNextAffordableReward,
  getNextStatusTier,
  getRewardById,
  getStatusTier,
  getTierProgress,
  normalizeRewardsState,
  parseGradeLevel
} from "../lib/progressRewards.js";
import {
  claimRewardTask,
  completeMentorControlledRewardTask,
  ensureRewardTaskInstances,
  getRewardShopOffers,
  getRewardWallet,
  grantRewardsWelcomeBonus,
  isMainMentorForStudent,
  listRewardRedemptions,
  listRewardTaskInstances,
  redeemCatalogReward,
  syncDashboardControlledRewardTasks,
  syncStudentNetworkMessageActivity,
  upsertStudentDailyActivity,
  fulfillRewardRedemption
} from "../../lib/dashboardData.js";
import {
  claimLocalRewardTask,
  completeLocalMentorTask,
  ensureLocalRewardTasks,
  grantLocalWelcomeBonus,
  loadLocalRewardWallet
} from "../../lib/progressRewardsRuntime.js";
import {
  resolveProgressRewardsStudentId,
  shouldUseRemoteProgressRewards
} from "../../lib/progressRewardsMentorAccess.js";
import { resolveShopOffers } from "../lib/rewardShop.js";
import { useSubscription } from "../../context/SubscriptionContext.jsx";
import { canAccessFeature, getEffectiveUserPlan } from "../../lib/planFeatures.js";
import {
  EARN_CATEGORY_ORDER,
  MILESTONE_CATEGORY_LABELS,
  REWARD_TASK_OWNERSHIP,
  REWARD_TASK_STATUS,
  getRecommendedEarnAction,
  getTaskDefinition
} from "../../lib/rewardTaskCatalog.js";
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
  const { isMentorStudentView, mentor: assignedMentor, mentorViewStudent } = useDashboardData();
  const { user: authUser } = useAuth();
  const subscription = useSubscription();
  const normalizedInitial = useMemo(() => normalizeRewardsState(initial), [initial]);
  const [state, setState] = useState(() => normalizedInitial);
  const [toasts, setToasts] = useState([]);
  const [celebration, setCelebration] = useState(null);
  const [redemptionCelebration, setRedemptionCelebration] = useState(null);
  const [shopState, setShopState] = useState(() => resolveShopOffers({ storageKey: shopStorageKey(user?.email) }));
  const [tasks, setTasks] = useState([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncState, setSyncState] = useState(() => createSyncState());
  const [rewardsSnapshot, setRewardsSnapshot] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const { triggerCoinBurst } = useInteractionFeedback();
  const { play, SOUND_EVENTS } = useInterfaceSound();
  // Plus (and Pro) unlock Progress Rewards — prefer active billing entitlement.
  const planId = getEffectiveUserPlan(user, subscription);
  // Plus/Pro include flexible session credits for SAT/ACT and tutoring reward tracks.
  const satActUnlocked = Boolean(profile?.satActPrep) || canAccessFeature(planId, "satActPrep");
  const tutoringUnlocked = Boolean(profile?.academicTutoring) || canAccessFeature(planId, "academicTutoring");
  const proBoost = canAccessFeature(planId, "advancedRewards");
  const rewardsUnlocked = canAccessFeature(planId, "rewards");
  // Synthetic mentor-view student users are authProvider "local" — do not use that for remote/assignment.
  const isSupabaseUser = user?.authProvider === "supabase";
  const rewardsStudentId = resolveProgressRewardsStudentId({
    isMentorStudentView,
    mentorViewStudentId: mentorViewStudent?.id,
    userId: user?.id
  });
  const usesRemoteRewards = shouldUseRemoteProgressRewards({
    isMentorStudentView,
    mentorViewStudentId: mentorViewStudent?.id,
    studentAuthProvider: user?.authProvider,
    authAuthProvider: authUser?.authProvider,
    studentUserId: user?.id
  });
  const usesTaskRuntime = usesRemoteRewards || isMentorStudentView || Boolean(user?.email);
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
    let cancelled = false;

    async function syncOffers() {
      let serverOffers = null;
      if (isSupabaseUser) {
        const { offers } = await getRewardShopOffers();
        if (offers?.rewardIds?.length) serverOffers = offers;
      }
      if (cancelled) return;
      const next = resolveShopOffers({ storageKey: key, serverOffers });
      setShopState((prev) => {
        if (
          prev.periodKey === next.periodKey &&
          prev.featuredPeriodKey === next.featuredPeriodKey &&
          prev.featuredRewardId === next.featuredRewardId &&
          JSON.stringify(prev.rewardIds) === JSON.stringify(next.rewardIds)
        ) {
          return prev;
        }
        return next;
      });
    }

    syncOffers();
    const id = window.setInterval(syncOffers, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isSupabaseUser, user?.email]);

  const [isMainAssignedMentor, setIsMainAssignedMentor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveMainMentor() {
      if (!isMentorStudentView || !authUser?.id) {
        setIsMainAssignedMentor(false);
        return;
      }
      // mentorViewStudent.id === profiles.id === mentor_matches.student_id
      // authUser.id === auth.uid() === mentor_matches.mentor_id
      const studentId = resolveProgressRewardsStudentId({
        isMentorStudentView,
        mentorViewStudentId: mentorViewStudent?.id,
        userId: user?.id
      });
      if (!studentId) {
        setIsMainAssignedMentor(false);
        return;
      }

      // Never gate on synthetic studentUser.authProvider ("local" in mentor view).
      if (authUser.authProvider === "supabase") {
        const { isMain } = await isMainMentorForStudent(authUser.id, studentId);
        if (!cancelled) setIsMainAssignedMentor(Boolean(isMain));
        return;
      }

      setIsMainAssignedMentor(
        assignedMentor?.id === authUser.id ||
          assignedMentor?.email === authUser.email ||
          Boolean(mentorViewStudent?.id)
      );
    }
    resolveMainMentor().catch(() => {
      if (!cancelled) setIsMainAssignedMentor(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    assignedMentor?.email,
    assignedMentor?.id,
    authUser?.authProvider,
    authUser?.email,
    authUser?.id,
    isMentorStudentView,
    mentorViewStudent?.id,
    user?.id
  ]);

  const refreshRewardTasks = useCallback(async () => {
    if (!rewardsStudentId && !user?.email) return;
    if (usesRemoteRewards && rewardsStudentId) {
      const [{ tasks: rows }, { wallet }, { redemptions, error: redemptionError }] = await Promise.all([
        listRewardTaskInstances(rewardsStudentId),
        getRewardWallet(rewardsStudentId),
        listRewardRedemptions(rewardsStudentId)
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
  }, [rewardsStudentId, satActUnlocked, tutoringUnlocked, user?.email, usesRemoteRewards]);

  useEffect(() => {
    let cancelled = false;
    async function loadRewardTasks() {
      if (!usesTaskRuntime || (!rewardsStudentId && !user?.email)) return;
      if (!rewardsUnlocked && !isMentorStudentView) {
        setTasks([]);
        setSyncLoading(false);
        setSyncState(createSyncState({ status: SYNC_STATUS.IDLE, source: "rewards" }));
        return;
      }
      setSyncLoading(true);
      setSyncState(createSyncState({ status: SYNC_STATUS.LOADING, source: "rewards" }));
      try {
        if (usesRemoteRewards && rewardsStudentId) {
          const ensured = await ensureRewardTaskInstances(rewardsStudentId, {
            satActUnlocked,
            tutoringUnlocked,
            // Mentor viewing a student must seed THAT student's tasks, not the mentor's.
            asStudentId: isMentorStudentView ? rewardsStudentId : null
          });
          if (cancelled) return;
          if (ensured?.error) {
            setSyncError(ensured.error);
            setSyncState(createSyncState({
              status: SYNC_STATUS.FAILED,
              error: ensured.error,
              source: "rewards"
            }));
          }
          if (!isMentorStudentView) {
            await upsertStudentDailyActivity(rewardsStudentId);
            await syncStudentNetworkMessageActivity(rewardsStudentId);
            await syncDashboardControlledRewardTasks(rewardsStudentId);
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
  }, [
    isMentorStudentView,
    refreshRewardTasks,
    rewardsStudentId,
    rewardsUnlocked,
    satActUnlocked,
    tutoringUnlocked,
    user?.email,
    usesRemoteRewards,
    usesTaskRuntime
  ]);

  // Keep student Claim UI fresh after mentor Complete without requiring a full remount.
  useEffect(() => {
    if (!usesTaskRuntime || !rewardsUnlocked || isMentorStudentView) return undefined;
    if (!usesRemoteRewards || !rewardsStudentId) return undefined;
    const id = window.setInterval(() => {
      refreshRewardTasks().catch(() => {});
    }, 20000);
    const onFocus = () => {
      refreshRewardTasks().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isMentorStudentView, refreshRewardTasks, rewardsStudentId, rewardsUnlocked, usesRemoteRewards, usesTaskRuntime]);

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
      if (!rewardsUnlocked) return;
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
  }, [isMentorStudentView, isSupabaseUser, refreshRewardTasks, rewardsUnlocked, showToast, user]);

  const grade = parseGradeLevel(profile?.grade);
  const isJordan = isJordanDemoEmail(user?.email);
  const studentFirstName = user?.name?.split(" ")[0] || profile?.firstName || "Your";
  const services = useMemo(
    () => (isJordan ? buildJordanDemoServices() : getActiveServices(profile)),
    [isJordan, profile]
  );

  const milestones = useMemo(() => {
    // Task runtime is the source of truth for Plus/Pro Progress Rewards.
    // Never fall back to the legacy catalog (all rows default to "Locked").
    if (usesTaskRuntime) {
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
  const featuredRewardBase = useMemo(() => {
    const fromShop = getRewardById(shopState.featuredRewardId);
    if (fromShop) return fromShop;
    return REWARD_CATALOG.find((r) => r.shopPool === "legendary") || REWARD_CATALOG[0];
  }, [shopState.featuredRewardId]);
  const featuredReward = useMemo(
    () => enrichReward(featuredRewardBase, state.coins, state.redeemed) || featuredRewardBase,
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
      // Assigned mentor only (isMainAssignedMentor now means actively assigned).
      if (!isMainAssignedMentor) return false;
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
        if (!isMainAssignedMentor) {
          showToast("You are not assigned to this student.", "error");
        }
        return;
      }

      if (usesRemoteRewards && authUser?.id && rewardsStudentId) {
        const result = await completeMentorControlledRewardTask(authUser.id, rewardsStudentId, milestoneId);
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
      milestones,
      refreshRewardTasks,
      rewardsStudentId,
      showToast,
      user?.email,
      usesRemoteRewards
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
      if (!reward || reward.active === false) return { success: false };

      if (state.redeemed.includes(rewardId)) {
        return { success: false, alreadyRedeemed: true };
      }

      if (state.coins < reward.coins) {
        return { success: false, coinsNeeded: reward.coins - state.coins };
      }

      const selectionValue = options.selection || options.testPrepOption;
      if (reward.requiresSelection && !selectionValue) {
        return { success: false, missingSelection: true };
      }

      const availableIds = new Set([
        ...(shopState.rewardIds || []),
        shopState.featuredRewardId
      ].filter(Boolean));
      if (!availableIds.has(rewardId)) {
        showToast("This reward is not available in today’s shop.", "error");
        return { success: false, unavailable: true };
      }

      const selectionLabel = selectionValue ? ` (${selectionValue})` : "";
      const snapshot = buildRewardCatalogSnapshot(reward);
      const historyEntry = {
        id: `redemption-${Date.now()}`,
        rewardId,
        title: `${reward.title}${selectionLabel}`,
        status: "ready_to_schedule",
        redeemedAt: new Date().toISOString(),
        selection: selectionValue || null,
        description: reward.description,
        fulfillmentType: reward.fulfillmentType,
        scope: reward.scope,
        wordLimit: reward.wordLimit ?? null,
        exclusions: reward.exclusions || null,
        mentorsRequired: reward.mentorsRequired || 1,
        coinCost: reward.coins,
        catalogSnapshot: snapshot
      };

      if (isSupabaseUser && user?.id) {
        const { redemption, wallet, error, alreadyRedeemed } = await redeemCatalogReward(user.id, {
          rewardId,
          selection: selectionValue || null
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
        title: reward.title,
        coinsBalance: state.coins - reward.coins,
        goalCoins: featuredRewardBase?.coins
      });
      play(SOUND_EVENTS.COIN_COLLECT);
      play(SOUND_EVENTS.REWARD_REDEEMED);
      setTimeout(() => setRedemptionCelebration(null), 3600);

      const followUp =
        reward.fulfillmentType === "live_call"
          ? "Reward redeemed! Your mentor will see it in Messages to coordinate scheduling."
          : "Reward redeemed! Your mentor will see it in Messages with next steps.";
      showToast(followUp, "success");
      return { success: true };
    },
    [
      featuredRewardBase?.coins,
      isSupabaseUser,
      persist,
      play,
      refreshRewardTasks,
      shopState.featuredRewardId,
      shopState.rewardIds,
      showToast,
      state.coins,
      state.redeemed,
      user?.id,
      SOUND_EVENTS.COIN_COLLECT,
      SOUND_EVENTS.REWARD_REDEEMED
    ]
  );

  const handleRedeemReward = redeemReward;

  const markRedemptionFulfilled = useCallback(
    async (redemptionId) => {
      if (!isMentorStudentView || !redemptionId) return { success: false };
      if (isSupabaseUser) {
        const { redemption, error, alreadyFulfilled } = await fulfillRewardRedemption(redemptionId);
        if (error) {
          showToast(error, "error");
          return { success: false, error };
        }
        await refreshRewardTasks();
        showToast(alreadyFulfilled ? "Already marked fulfilled." : "Marked as fulfilled.");
        return { success: true, redemption };
      }
      setState((prev) => {
        const next = {
          ...prev,
          redemptionHistory: prev.redemptionHistory.map((item) =>
            item.id === redemptionId
              ? { ...item, status: "fulfilled", fulfilledAt: new Date().toISOString() }
              : item
          )
        };
        persist(next);
        return next;
      });
      showToast("Marked as fulfilled.");
      return { success: true };
    },
    [isMentorStudentView, isSupabaseUser, persist, refreshRewardTasks, showToast]
  );

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
      redeemReward,
      handleRedeemReward,
      markRedemptionFulfilled,
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
      markRedemptionFulfilled,
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
