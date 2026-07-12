import { useEffect, useState } from "react";
import AnimatedIcon from "../../../components/interaction/AnimatedIcon.jsx";
import InteractiveButton from "../../../components/interaction/InteractiveButton.jsx";
import {
  CheckCircle2,
  Circle,
  Gift,
  Lock,
  Star,
  Ticket,
  Zap
} from "lucide-react";
import { REWARD_TASK_OWNERSHIP, REWARD_TASK_STATUS } from "../../../lib/rewardTaskCatalog.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { CoinBalance, CoinIcon, Sparkles } from "./rewards/PreludePiggyBank.jsx";
import PiggyBankProgress from "./rewards/PiggyBankProgress.jsx";
import MyStatusProgressBar from "./rewards/MyStatusProgressBar.jsx";
import { ProgressBar, RedeemTab } from "./rewards/RedeemTab.jsx";
import { RewardsSidebarBottom, RewardsSidebarTop } from "./rewards/RewardsSidebar.jsx";
import PlanLockedFeature from "./PlanLockedFeature.jsx";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";

const TABS = [
  { id: "redeem", label: "Redeem", icon: Gift },
  { id: "status", label: "My Status", icon: Star },
  { id: "my-rewards", label: "My Rewards", icon: Ticket },
  { id: "earn", label: "Earn Coins", icon: Zap }
];

function RewardsHero() {
  const {
    coins,
    currentTier,
    piggyGoalCoins,
    piggyProgressLabel,
    piggyCanRedeem
  } = useProgressRewards();

  const goalCoins = piggyGoalCoins > 0 ? piggyGoalCoins : 60;
  const heroPct = goalCoins > 0 ? Math.min(100, Math.round((coins / goalCoins) * 100)) : 0;

  return (
    <header className="dash-rewards-hero">
      <div className="dash-rewards-hero__info">
        <div className="dash-rewards-hero__eyebrow">
          <span className="dash-rewards-hero__eyebrow-icon" aria-hidden="true">
            <Star />
          </span>
          Prelude Rewards
        </div>
        <h1 className="dash-rewards-hero__title">
          <span>Fill your</span>
          <span>Piggy Bank</span>
        </h1>
        <p className="dash-rewards-hero__subtitle">Earn coins, hit goals, and unlock awesome rewards.</p>

        <div className="dash-rewards-hero__stats">
          <div className="dash-rewards-hero__stat">
            <CoinIcon size="lg" />
            <div className="dash-rewards-hero__stat-copy">
              <CoinBalance value={coins} className="dash-rewards-hero__balance" />
              <span className="dash-rewards-hero__balance-label">Available Coins</span>
            </div>
          </div>
          <div className="dash-rewards-hero__stat-divider" aria-hidden="true" />
          <div className="dash-rewards-hero__tier">
            <Star className="dash-rewards-hero__tier-icon" aria-hidden="true" />
            {currentTier.name}
          </div>
        </div>

        <div className="dash-rewards-hero__progress">
          <div className="dash-rewards-hero__range">
            <span>0</span>
            <span>{goalCoins.toLocaleString()}</span>
          </div>
          <ProgressBar pct={heroPct} className="dash-rewards-progress--hero" />
          <p className="dash-rewards-hero__progress-label">
            {piggyCanRedeem
              ? "You can redeem a reward now"
              : `${coins.toLocaleString()} / ${goalCoins.toLocaleString()} coins until first reward`}
          </p>
          {!piggyCanRedeem && piggyProgressLabel ? (
            <p className="dash-muted" style={{ marginTop: "0.35rem" }}>
              {piggyProgressLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="dash-rewards-hero__visual">
        <div className="dash-rewards-hero__scene">
          <div className="dash-rewards-hero__scene-fx" aria-hidden="true">
            <span className="dash-rewards-hero__scene-glow" />
            <Sparkles className="dash-rewards-hero__scene-sparkles" />
            <span className="dash-rewards-hero__scene-bubble dash-rewards-hero__scene-bubble--1" />
            <span className="dash-rewards-hero__scene-bubble dash-rewards-hero__scene-bubble--2" />
            <span className="dash-rewards-hero__scene-float-coin" />
          </div>
          <PiggyBankProgress
            coins={coins}
            goalCoins={goalCoins}
            size="hero"
            withDropAnimation={false}
            piggyAnimate={false}
            className="dash-rewards-hero__piggy"
          />
        </div>
      </div>
    </header>
  );
}

function RewardsTabs({ active, onChange }) {
  return (
    <nav className="dash-rewards-tabs" aria-label="Rewards sections">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            className={`dash-rewards-tabs__tab${active === tab.id ? " dash-rewards-tabs__tab--active" : ""}`}
            aria-selected={active === tab.id}
            onClick={() => onChange(tab.id)}
          >
            <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function StatusTab() {
  const { lifetimeCoins, coins, services } = useProgressRewards();

  return (
    <div className="dash-rewards-tab-panel dash-rewards-status">
      <MyStatusProgressBar
        coins={coins}
        lifetimeCoins={lifetimeCoins}
        satActUnlocked={Boolean(services?.satActPrep)}
        tutoringUnlocked={Boolean(services?.academicTutoring)}
      />
    </div>
  );
}

function MyRewardsTab() {
  const { redemptionHistory } = useProgressRewards();

  const items = redemptionHistory.map((h) => ({
    id: h.id,
    title: h.title,
    status: h.status === "ready_to_schedule" ? "Ready to schedule" : "Redeemed"
  }));

  if (!items.length) {
    return (
      <div className="dash-rewards-tab-panel dash-rewards-empty">
        <PiggyBankProgress coins={0} goalCoins={60} size="sm" withDropAnimation={false} />
        <p>No rewards redeemed yet. Complete milestones to unlock free support.</p>
      </div>
    );
  }

  return (
    <div className="dash-rewards-tab-panel">
      <div className="dash-rewards-my-list">
        {items.map((item) => (
          <article key={item.id} className="dash-rewards-my-card">
            <h4 className="dash-rewards-my-card__title">{item.title}</h4>
            <p className="dash-rewards-my-card__status">{item.status}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function EarnMilestoneRow({ milestone, onComplete, isMentorStudentView, canMentorCompleteTask, isMainAssignedMentor }) {
  const { status, title, coins, progress, progressCurrent, progressTarget, ownershipType, claimable, locked, taskTemplateId } = milestone;
  const statusLabel =
    status === REWARD_TASK_STATUS.CLAIMED
      ? "Claimed"
      : claimable
        ? "Ready to claim"
        : status === REWARD_TASK_STATUS.COMPLETED_BY_MENTOR
          ? "Ready to claim"
          : status === REWARD_TASK_STATUS.IN_PROGRESS
            ? "In Progress"
            : "Locked";
  const [completing, setCompleting] = useState(false);
  const mentorCanComplete = isMentorStudentView && canMentorCompleteTask?.(milestone);
  const mentorMeetingLocked = isMentorStudentView && taskTemplateId === "mentor-meeting-completed" && !isMainAssignedMentor;

  return (
    <div className={`dash-rewards-earn-row dash-rewards-earn-row--${status}`}>
      <span className="dash-rewards-earn-row__icon" aria-hidden="true">
        {status === REWARD_TASK_STATUS.CLAIMED ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : locked ? (
          <Lock className="h-4 w-4" />
        ) : claimable ? (
          <Sparkles className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </span>
      <div className="dash-rewards-earn-row__main">
        <span className="dash-rewards-earn-row__title">{title}</span>
        <span className="dash-rewards-earn-row__meta">
          +{coins} Prelude Coins · {statusLabel}
          {ownershipType === REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED ? " · Auto-tracked" : ""}
        </span>
        {status === REWARD_TASK_STATUS.IN_PROGRESS ? (
          <>
            <ProgressBar pct={progress} className="dash-rewards-progress--compact" />
            <span className="dash-rewards-earn-row__meta">{progressCurrent} / {progressTarget}</span>
          </>
        ) : null}
      </div>
      {!isMentorStudentView && claimable ? (
        <InteractiveButton
          type="button"
          className="dash-btn dash-btn--primary dash-btn--sm"
          loading={completing}
          onClick={async () => {
            setCompleting(true);
            await onComplete(milestone.id, "claim");
            window.setTimeout(() => setCompleting(false), 500);
          }}
        >
          Claim
        </InteractiveButton>
      ) : null}
      {isMentorStudentView && mentorCanComplete ? (
        <InteractiveButton
          type="button"
          className="dash-btn dash-btn--primary dash-btn--sm"
          loading={completing}
          onClick={async () => {
            setCompleting(true);
            await onComplete(milestone.id, "complete");
            window.setTimeout(() => setCompleting(false), 500);
          }}
        >
          Complete
        </InteractiveButton>
      ) : null}
      {ownershipType === REWARD_TASK_OWNERSHIP.DASHBOARD_CONTROLLED ? (
        <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" disabled>
          Auto-tracked
        </button>
      ) : null}
      {!isMentorStudentView && status === REWARD_TASK_STATUS.IN_PROGRESS && ownershipType === REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED ? (
        <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" disabled>
          Mentor controlled
        </button>
      ) : null}
      {isMentorStudentView && mentorMeetingLocked && ownershipType === REWARD_TASK_OWNERSHIP.MENTOR_CONTROLLED ? (
        <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" disabled title="Only the main assigned mentor can complete this task">
          Main mentor only
        </button>
      ) : null}
      {!isMentorStudentView && status === REWARD_TASK_STATUS.IN_PROGRESS && !ownershipType ? (
        <InteractiveButton
          type="button"
          className="dash-btn dash-btn--secondary dash-btn--sm"
          loading={completing}
          onClick={async () => {
            setCompleting(true);
            await onComplete(milestone.id, "complete");
            window.setTimeout(() => setCompleting(false), 500);
          }}
        >
          <AnimatedIcon variant="trophy" active={completing}>
            Complete
          </AnimatedIcon>
        </InteractiveButton>
      ) : null}
    </div>
  );
}

function EarnTab() {
  const {
    milestones,
    completeMilestone,
    claimMilestone,
    earnCategoryOrder,
    milestoneCategoryLabels,
    isMentorStudentView,
    canMentorCompleteTask,
    isMainAssignedMentor
  } = useProgressRewards();

  const grouped = earnCategoryOrder.reduce((acc, cat) => {
    const items = milestones.filter((m) => m.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="dash-rewards-tab-panel dash-rewards-earn" id="earn">
      {isMentorStudentView ? (
        <p className="dash-rewards-earn__intro">
          Complete eligible reward tasks for this student. Coins are added only after the student claims the reward.
        </p>
      ) : (
        <p className="dash-rewards-earn__intro">Complete milestones to fill your Piggy Bank and save toward free rewards.</p>
      )}
      {Object.entries(grouped).map(([category, items]) => (
        <details key={category} className="dash-rewards-earn-group" open={category === "momentum" || category === "admissions"}>
          <summary className="dash-rewards-earn-group__summary">{milestoneCategoryLabels[category]}</summary>
          <div className="dash-rewards-earn-group__list">
            {items.map((m) => (
              <EarnMilestoneRow
                key={m.id}
                milestone={m}
                isMentorStudentView={isMentorStudentView}
                canMentorCompleteTask={canMentorCompleteTask}
                isMainAssignedMentor={isMainAssignedMentor}
                onComplete={(id, mode) => (mode === "claim" ? claimMilestone(id) : completeMilestone(id))}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function StudentProgressRewardsProduct() {
  const { isMentorStudentView } = useDashboardData();
  const [activeTab, setActiveTab] = useState(isMentorStudentView ? "earn" : "redeem");
  const { canAccess } = usePlanAccess();
  const { syncError, retrySync } = useProgressRewards();

  useEffect(() => {
    const syncTab = () => {
      if (window.location.hash === "#earn") setActiveTab("earn");
    };
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  return (
    <div className="dash-page dash-rewards-loyalty">
      <div className="dash-rewards-loyalty__shell">
        {syncError ? (
          <div className="dash-save-state dash-save-state--error" role="alert">
            {syncError} <button type="button" onClick={retrySync}>Retry</button>
          </div>
        ) : null}
        <RewardsHero />
        <RewardsSidebarTop />
        <div className="dash-rewards-loyalty__main">
          <RewardsTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === "redeem" ? <RedeemTab /> : null}
          {activeTab === "status" ? <StatusTab /> : null}
          {activeTab === "my-rewards" ? <MyRewardsTab /> : null}
          {activeTab === "earn" ? <EarnTab /> : null}

          {!isMentorStudentView && !canAccess("advancedRewards") ? (
            <PlanLockedFeature feature="advancedRewards" compact className="dash-rewards-pro-boost" />
          ) : !isMentorStudentView ? (
            <div className="dash-rewards-pro-boost dash-rewards-pro-boost--active" role="status">
              <Zap className="h-4 w-4" aria-hidden="true" />
              <p>Pro earning boost active — you earn coins faster on every milestone.</p>
            </div>
          ) : null}
        </div>
        <RewardsSidebarBottom onViewAllChallenges={() => setActiveTab("earn")} />
      </div>
    </div>
  );
}
