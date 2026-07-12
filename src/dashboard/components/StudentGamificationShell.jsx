import { useMemo } from "react";
import { GamificationProvider } from "../context/GamificationContext.jsx";
import { ProgressRewardsProvider } from "../context/ProgressRewardsContext.jsx";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import { buildDefaultProgressRewards } from "../lib/progressRewards.js";
import { isJordanDemoEmail } from "../../data/demoAccounts.js";

const EMPTY_GAMIFICATION = { xp: 0, streak: 0, missions: [], badges: [], activityFeed: [], nextBadge: null };
const EMPTY_REWARDS = { coins: 0, completed: [], inProgress: [], inProgressProgress: {}, redeemed: [], redemptionHistory: [] };

export default function StudentGamificationShell({ user, children }) {
  const { gamification, progressRewards, profile } = useDashboardData();
  const isJordan = isJordanDemoEmail(user?.email);
  const isSupabaseUser = user?.authProvider === "supabase";
  const initialGamification = gamification || EMPTY_GAMIFICATION;
  const initialRewards = useMemo(() => {
    if (isSupabaseUser) return EMPTY_REWARDS;
    return progressRewards || buildDefaultProgressRewards(isJordan);
  }, [isJordan, isSupabaseUser, progressRewards]);

  return (
    <GamificationProvider user={user} initial={initialGamification}>
      <ProgressRewardsProvider user={user} profile={profile} initial={initialRewards}>
        {children}
      </ProgressRewardsProvider>
    </GamificationProvider>
  );
}
