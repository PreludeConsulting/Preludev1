import { Calendar, Coins, Flame, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../../lib/dashboardRoutes.js";
import { useProgressRewards } from "../../../context/ProgressRewardsContext.jsx";
import ChallengesCard from "./ChallengesCard.jsx";
import DailyMomentumCard from "./DailyMomentumCard.jsx";
import HowItWorksCard from "./HowItWorksCard.jsx";

function ProgressOverviewCard() {
  const { sidebarProgress } = useProgressRewards();

  return (
    <section className="dash-rewards-sidebar__card dash-rewards-sidebar__overview">
      <h3 className="dash-rewards-sidebar__title">My Progress Overview</h3>
      <ul className="dash-rewards-sidebar__overview-list">
        <li>
          <span className="dash-rewards-sidebar__overview-icon dash-rewards-sidebar__overview-icon--purple">
            <Star className="h-4 w-4" />
          </span>
          <span className="dash-rewards-sidebar__overview-label">Milestones Completed</span>
          <span className="dash-rewards-sidebar__overview-value">{sidebarProgress.milestonesCompleted}</span>
        </li>
        <li>
          <span className="dash-rewards-sidebar__overview-icon dash-rewards-sidebar__overview-icon--orange">
            <Flame className="h-4 w-4" />
          </span>
          <span className="dash-rewards-sidebar__overview-label">Current Streak</span>
          <span className="dash-rewards-sidebar__overview-value">{sidebarProgress.currentStreak} days</span>
        </li>
        <li>
          <span className="dash-rewards-sidebar__overview-icon dash-rewards-sidebar__overview-icon--blue">
            <Calendar className="h-4 w-4" />
          </span>
          <span className="dash-rewards-sidebar__overview-label">Meetings Completed</span>
          <span className="dash-rewards-sidebar__overview-value">{sidebarProgress.meetingsCompleted}</span>
        </li>
        <li>
          <span className="dash-rewards-sidebar__overview-icon dash-rewards-sidebar__overview-icon--mint">
            <Coins className="h-4 w-4" />
          </span>
          <span className="dash-rewards-sidebar__overview-label">Coins Earned</span>
          <span className="dash-rewards-sidebar__overview-value">{sidebarProgress.coinsEarned}</span>
        </li>
      </ul>
      <Link to={`${STUDENT_DASHBOARD_BASE}/progress-rewards#earn`} className="dash-btn dash-btn--primary dash-rewards-sidebar__cta">
        Earn more coins
      </Link>
    </section>
  );
}

export function RewardsSidebarTop() {
  return (
    <div className="dash-rewards-loyalty__sidebar-top">
      <ProgressOverviewCard />
      <DailyMomentumCard />
    </div>
  );
}

export function RewardsSidebarBottom({ onViewAllChallenges = null }) {
  return (
    <aside className="dash-rewards-loyalty__sidebar-bottom" aria-label="Rewards progress">
      <ChallengesCard onViewAll={onViewAllChallenges} />
      <HowItWorksCard />
    </aside>
  );
}

export default function RewardsSidebar() {
  return (
    <aside className="dash-rewards-sidebar" aria-label="Rewards progress">
      <ProgressOverviewCard />
      <DailyMomentumCard />
      <ChallengesCard />
      <HowItWorksCard />
    </aside>
  );
}
