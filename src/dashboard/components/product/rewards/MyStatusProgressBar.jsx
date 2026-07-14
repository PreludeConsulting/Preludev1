import {
  Check,
  ChevronRight,
  Crown,
  FileText,
  Mountain,
  Sprout,
  Target,
  Trophy,
  Zap
} from "lucide-react";
import {
  PRO_PLAN_COIN_BOOST,
  STATUS_MILESTONES,
  formatMultiplierLabel,
  formatStatusProgressCopy,
  getCoinMultiplier,
  getCurrentStatusMilestone,
  getMilestoneNodeStatus,
  getNextStatusMilestone,
  getStatusCoinMultiplier
} from "../../../lib/progressRewards.js";
import { getRecommendedEarnAction } from "../../../../lib/rewardTaskCatalog.js";
import { CoinIcon } from "./PreludePiggyBank.jsx";

const ICONS = {
  trophy: Trophy,
  seedling: Sprout,
  target: Target,
  zap: Zap,
  file: FileText,
  mountain: Mountain,
  crown: Crown
};

export default function MyStatusProgressBar({
  coins,
  lifetimeCoins,
  satActUnlocked = true,
  tutoringUnlocked = true,
  proBoost = false
}) {
  const statusCoins = Number(lifetimeCoins ?? coins ?? 0);
  const current = getCurrentStatusMilestone(statusCoins);
  const next = getNextStatusMilestone(statusCoins);
  const statusMultiplier = getStatusCoinMultiplier(statusCoins);
  const multiplier = getCoinMultiplier(statusCoins, { proBoost });
  const progressCopy = formatStatusProgressCopy(statusCoins);
  const recommended = getRecommendedEarnAction(progressCopy.coinsNeeded || 0, multiplier, {
    satActUnlocked,
    tutoringUnlocked
  });

  const CurrentIcon = ICONS[current.icon] || Trophy;
  const n = STATUS_MILESTONES.length;
  const firstCenter = (0.5 / n) * 100;
  const lastCenter = ((n - 0.5) / n) * 100;
  const nextIndex = next ? STATUS_MILESTONES.findIndex((m) => m.id === next.id) : n - 1;
  const targetCenter = ((nextIndex + 0.5) / n) * 100;
  const lineLeft = firstCenter;
  const lineWidth = lastCenter - firstCenter;
  const fillWidth = Math.max(0, targetCenter - firstCenter);

  return (
    <div className="dash-mystatus">
      <div className="dash-mystatus__summary">
        <div className="dash-mystatus__summary-left">
          <div className="dash-mystatus__badge" aria-hidden="true">
            <CurrentIcon />
          </div>
          <div>
            <p className="dash-mystatus__eyebrow">Current Status</p>
            <h3 className="dash-mystatus__title">{current.name}</h3>
            <p className="dash-mystatus__coins">{statusCoins.toLocaleString()} lifetime Prelude Coins</p>
          </div>
        </div>

        <div className="dash-mystatus__mult">
          <span className="dash-mystatus__mult-label">
            {proBoost ? "Total Coin Multiplier" : "Current Coin Multiplier"}
          </span>
          <div className="dash-mystatus__mult-row">
            <span className="dash-mystatus__mult-value">{formatMultiplierLabel(multiplier)}x</span>
            {proBoost ? <span className="dash-mystatus__pro-badge">Pro Boost</span> : null}
            <CoinIcon size="lg" className="dash-mystatus__mult-coin" />
          </div>
          {proBoost ? (
            <dl className="dash-mystatus__mult-breakdown">
              <div>
                <dt>Status Multiplier</dt>
                <dd>{formatMultiplierLabel(statusMultiplier)}x</dd>
              </div>
              <div>
                <dt>Pro Plan Boost</dt>
                <dd>+{formatMultiplierLabel(PRO_PLAN_COIN_BOOST)}x</dd>
              </div>
              <div className="dash-mystatus__mult-breakdown-total">
                <dt>Total Coin Multiplier</dt>
                <dd>{formatMultiplierLabel(multiplier)}x</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>

      <div className="dash-mystatus__track">
        <div
          className="dash-mystatus__line"
          style={{ left: `${lineLeft}%`, width: `${lineWidth}%` }}
          aria-hidden="true"
        >
          <span className="dash-mystatus__line-fill" style={{ width: `${(fillWidth / lineWidth) * 100}%` }} />
        </div>

        <div className="dash-mystatus__cols">
          {STATUS_MILESTONES.map((milestone) => {
            const status = getMilestoneNodeStatus(statusCoins, milestone);
            const Icon = ICONS[milestone.icon] || Target;
            return (
              <div key={milestone.id} className={`dash-mystatus__col dash-mystatus__col--${status}`}>
                <div className="dash-mystatus__node" aria-hidden="true">
                  <Icon className="dash-mystatus__node-icon" />
                  {status === "completed" ? (
                    <span className="dash-mystatus__node-check">
                      <Check />
                    </span>
                  ) : null}
                </div>
                <div className="dash-mystatus__label">
                  <span className="dash-mystatus__label-name">{milestone.name}</span>
                  <span className="dash-mystatus__label-coins">{milestone.coinsRequired.toLocaleString()}</span>
                  <span className="dash-mystatus__label-mult">
                    {formatMultiplierLabel(milestone.multiplier)}x
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {next ? (
        <div className="dash-mystatus__banner">
          <div className="dash-mystatus__banner-icon" aria-hidden="true">
            <Target />
            <CoinIcon size="sm" className="dash-mystatus__banner-coin" />
          </div>
          <div className="dash-mystatus__banner-text">
            <p className="dash-mystatus__banner-title">{progressCopy.title}</p>
            <p className="dash-mystatus__banner-sub">{recommended || progressCopy.subtitle}</p>
          </div>
          <ChevronRight className="dash-mystatus__banner-chevron" aria-hidden="true" />
        </div>
      ) : (
        <div className="dash-mystatus__banner dash-mystatus__banner--max">
          <div className="dash-mystatus__banner-icon" aria-hidden="true">
            <Crown />
          </div>
          <div className="dash-mystatus__banner-text">
            <p className="dash-mystatus__banner-title">{progressCopy.title}</p>
            <p className="dash-mystatus__banner-sub">{progressCopy.subtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
