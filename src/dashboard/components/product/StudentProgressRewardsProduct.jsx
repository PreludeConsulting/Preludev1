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
import { EARN_CATEGORY_ORDER, MILESTONE_CATEGORY_LABELS, STATUS_TIERS } from "../../lib/progressRewards.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import PreludePiggyBank, { CoinBalance, CoinIcon } from "./rewards/PreludePiggyBank.jsx";
import { ProgressBar, RedeemTab } from "./rewards/RedeemTab.jsx";
import RewardsSidebar from "./rewards/RewardsSidebar.jsx";
import PreludeConstellation from "./PreludeConstellation.jsx";

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
    featuredReward,
    completedCount,
    milestones,
    celebration
  } = useProgressRewards();
  const heroPct = featuredReward?.progressPct ?? 0;
  const coinsToGoal = featuredReward?.coinsAway ?? 0;

  return (
    <header className="dash-rewards-hero">
      <div className="dash-rewards-hero__pig">
        <PreludeConstellation
          variant="rewards"
          value={completedCount}
          total={milestones.length}
          active={Boolean(celebration)}
          label={`${completedCount} of ${milestones.length} reward milestones completed`}
        />
        <PreludePiggyBank size="sm" animate={false} className="dash-rewards-hero__mascot" />
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
          <p className="dash-rewards-hero__goal-hint">
            {coinsToGoal > 0 ? `${coinsToGoal} coins to ${featuredReward?.headline ?? "your next reward"}` : "Ready for your next reward"}
          </p>
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
  const { coins, currentTier, nextTier, tierProgress, coinsToNextTier } = useProgressRewards();

  return (
    <div className="dash-rewards-tab-panel dash-rewards-status">
      <article className="dash-rewards-status__current">
        <p className="dash-rewards-status__label">Current status</p>
        <h3 className="dash-rewards-status__tier">{currentTier.name}</h3>
        <p className="dash-rewards-status__coins">{coins} Prelude Coins available</p>
        {nextTier ? (
          <>
            <ProgressBar pct={tierProgress} />
            <p className="dash-rewards-status__hint">{coinsToNextTier} coins to reach {nextTier.name}</p>
          </>
        ) : (
          <p className="dash-rewards-status__hint">You&apos;ve reached the highest status tier.</p>
        )}
      </article>
      <div className="dash-rewards-status__tiers">
        {STATUS_TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier.id;
          const rangeLabel = tier.max === Infinity ? `${tier.min}+ Coins` : `${tier.min} – ${tier.max} Coins`;
          return (
            <article key={tier.id} className={`dash-rewards-tier-card${isCurrent ? " dash-rewards-tier-card--current" : ""}`}>
              <div className="dash-rewards-tier-card__head">
                <h4 className="dash-rewards-tier-card__name">{tier.name}</h4>
                <span className="dash-rewards-tier-card__range">{rangeLabel}</span>
              </div>
              <ul className="dash-rewards-tier-card__benefits">
                {tier.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
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
        <PreludePiggyBank size="sm" />
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
