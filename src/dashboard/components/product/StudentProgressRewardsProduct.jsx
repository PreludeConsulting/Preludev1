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
import { EARN_CATEGORY_ORDER, MILESTONE_CATEGORY_LABELS } from "../../lib/progressRewards.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import { CoinBalance, CoinIcon } from "./rewards/PreludePiggyBank.jsx";
import PiggyBankProgress from "./rewards/PiggyBankProgress.jsx";
import MyStatusProgressBar from "./rewards/MyStatusProgressBar.jsx";
import { ProgressBar, RedeemTab } from "./rewards/RedeemTab.jsx";
import RewardsSidebar from "./rewards/RewardsSidebar.jsx";

const TABS = [
  { id: "redeem", label: "Redeem", icon: Gift },
  { id: "status", label: "My Status", icon: Star },
  { id: "my-rewards", label: "My Rewards", icon: Ticket },
  { id: "earn", label: "Earn Coins", icon: Zap }
];

function RewardsHero() {
  const {
    coins,
    studentFirstName,
    currentTier,
    nextTier,
    statusGoalCoins,
    coinsToNextMultiplier,
    celebration
  } = useProgressRewards();

  const goalCoins = statusGoalCoins > 0 ? statusGoalCoins : 300;
  const heroPct = goalCoins > 0 ? Math.min(100, Math.round((coins / goalCoins) * 100)) : 0;
  const goalLabel = nextTier
    ? `${coinsToNextMultiplier.toLocaleString()} coins until ${nextTier.name}`
    : "All status milestones unlocked";

  return (
    <header className="dash-rewards-hero">
      <div className="dash-rewards-hero__pig">
        <PiggyBankProgress
          coins={coins}
          goalCoins={goalCoins}
          size="hero"
          piggyAnimate={Boolean(celebration)}
          showBalance
          goalLabel={goalLabel}
        />
      </div>
      <div className="dash-rewards-hero__center">
        <p className="dash-rewards-hero__status-label">{studentFirstName}&apos;s Piggy Bank</p>
        <div className="dash-rewards-hero__balance-wrap">
          <CoinBalance value={coins} className="dash-rewards-hero__balance" />
          <CoinIcon size="lg" />
        </div>
        <p className="dash-rewards-hero__balance-label">Available Coins</p>
        <span className="dash-rewards-hero__tier-badge">{currentTier.name}</span>
        <div className="dash-rewards-hero__goal">
          <p className="dash-rewards-hero__goal-hint">{goalLabel}</p>
          <ProgressBar pct={heroPct} className="dash-rewards-progress--hero" />
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
  const { coins } = useProgressRewards();

  return (
    <div className="dash-rewards-tab-panel dash-rewards-status">
      <MyStatusProgressBar coins={coins} />
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
        <PiggyBankProgress coins={0} goalCoins={300} size="sm" withDropAnimation={false} />
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

function EarnMilestoneRow({ milestone, onComplete }) {
  const { status, title, coins, progress } = milestone;
  const statusLabel = status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Locked";
  const [completing, setCompleting] = useState(false);

  return (
    <div className={`dash-rewards-earn-row dash-rewards-earn-row--${status}`}>
      <span className="dash-rewards-earn-row__icon" aria-hidden="true">
        {status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : status === "in_progress" ? <Circle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </span>
      <div className="dash-rewards-earn-row__main">
        <span className="dash-rewards-earn-row__title">{title}</span>
        <span className="dash-rewards-earn-row__meta">+{coins} Prelude Coins · {statusLabel}</span>
        {status === "in_progress" ? <ProgressBar pct={progress} className="dash-rewards-progress--compact" /> : null}
      </div>
      {status === "in_progress" ? (
        <InteractiveButton
          type="button"
          className="dash-btn dash-btn--secondary dash-btn--sm"
          loading={completing}
          onClick={() => {
            setCompleting(true);
            onComplete(milestone.id);
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
  const { milestones, completeMilestone } = useProgressRewards();

  const grouped = EARN_CATEGORY_ORDER.reduce((acc, cat) => {
    const items = milestones.filter((m) => m.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="dash-rewards-tab-panel dash-rewards-earn" id="earn">
      <p className="dash-rewards-earn__intro">Complete milestones to fill your Piggy Bank and save toward free rewards.</p>
      {Object.entries(grouped).map(([category, items]) => (
        <details key={category} className="dash-rewards-earn-group" open={category === "momentum" || category === "admissions"}>
          <summary className="dash-rewards-earn-group__summary">{MILESTONE_CATEGORY_LABELS[category]}</summary>
          <div className="dash-rewards-earn-group__list">
            {items.map((m) => (
              <EarnMilestoneRow key={m.id} milestone={m} onComplete={completeMilestone} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function StudentProgressRewardsProduct() {
  const [activeTab, setActiveTab] = useState("redeem");

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
        <div className="dash-rewards-loyalty__main">
          <RewardsHero />
          <RewardsTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === "redeem" ? <RedeemTab /> : null}
          {activeTab === "status" ? <StatusTab /> : null}
          {activeTab === "my-rewards" ? <MyRewardsTab /> : null}
          {activeTab === "earn" ? <EarnTab /> : null}
        </div>

        <RewardsSidebar />
      </div>
    </div>
  );
}
