import { GamificationProvider } from "../context/GamificationContext.jsx";
import { useDashboardData } from "../context/DashboardDataContext.jsx";

export default function StudentGamificationShell({ user, children }) {
  const { gamification } = useDashboardData();
  const initial = gamification || { xp: 0, streak: 0, missions: [], badges: [], activityFeed: [], nextBadge: null };
  return (
    <GamificationProvider user={user} initial={initial}>
      {children}
    </GamificationProvider>
  );
}
