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
  STATUS_MILESTONES,
  formatStatusProgressCopy,
  getCoinMultiplier,
  getCurrentStatusMilestone,
  getMilestoneNodeStatus,
  getNextStatusMilestone
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
  tutoringUnlocked = true
}) {
  const statusCoins = Number(lifetimeCoins ?? coins ?? 0);
  const current = getCurrentStatusMilestone(statusCoins);
  const next = getNextStatusMilestone(statusCoins);
  const multiplier = getCoinMultiplier(statusCoins);
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
          <span className="dash-mystatus__mult-label">Current Coin Multiplier</span>
          <div className="dash-mystatus__mult-row">
            <span className="dash-mystatus__mult-value">
              {multiplier % 1 === 0 ? multiplier.toFixed(1) : String(multiplier)}x
            </span>
            <CoinIcon size="lg" className="dash-mystatus__mult-coin" />
          </div>
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
                    {milestone.multiplier % 1 === 0
                      ? milestone.multiplier.toFixed(1)
                      : String(milestone.multiplier)}
                    x
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
