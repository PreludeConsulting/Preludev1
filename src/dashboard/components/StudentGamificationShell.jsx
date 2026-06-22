import { GamificationProvider } from "../context/GamificationContext.jsx";
import { ProgressRewardsProvider } from "../context/ProgressRewardsContext.jsx";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import { buildDefaultProgressRewards } from "../lib/progressRewards.js";

export default function StudentGamificationShell({ user, children }) {
  const { gamification, progressRewards, profile } = useDashboardData();
  const initialGamification = gamification || { xp: 0, streak: 0, missions: [], badges: [], activityFeed: [], nextBadge: null };
  const isJordan = user?.email === "student@prelude-demo.com";
  const initialRewards = progressRewards || buildDefaultProgressRewards(isJordan);

  return (
    <GamificationProvider user={user} initial={initialGamification}>
      <ProgressRewardsProvider user={user} profile={profile} initial={initialRewards}>
        {children}
      </ProgressRewardsProvider>
    </GamificationProvider>
  );
}
