import {
  STATUS_MILESTONES,
  getCoinMultiplier,
  getCoinsToNextMultiplier,
  getCurrentStatusMilestone,
  getMilestoneNodeStatus,
  getNextStatusMilestone,
  getStatusBarProgressPct
} from "../../../lib/progressRewards.js";
import StatusMilestoneNode from "./StatusMilestoneNode.jsx";

/** Map coin totals to horizontal position along the tracker (0–100%). */
function milestonePositionPct(coinsRequired, maxCoins) {
  if (!maxCoins) return 0;
  return (coinsRequired / maxCoins) * 100;
}

export default function MyStatusProgressBar({ coins }) {
  const current = getCurrentStatusMilestone(coins);
  const next = getNextStatusMilestone(coins);
  const multiplier = getCoinMultiplier(coins);
  const barPct = getStatusBarProgressPct(coins);
  const coinsToNext = getCoinsToNextMultiplier(coins);
  const maxCoins = STATUS_MILESTONES[STATUS_MILESTONES.length - 1].coinsRequired;
  const progressPct = milestonePositionPct(coins, maxCoins);

  return (
    <div className="dash-status-progress">
      <div className="dash-status-progress__summary">
        <div className="dash-status-progress__summary-left">
          <p className="dash-status-progress__eyebrow">Current status</p>
          <h3 className="dash-status-progress__title">{current.name}</h3>
          <p className="dash-status-progress__coins">{coins.toLocaleString()} Prelude Coins earned</p>
        </div>
        <div className="dash-status-progress__multiplier-wrap">
          <span className="dash-status-progress__multiplier-label">Current Coin Multiplier</span>
          <span className="dash-status-progress__multiplier">{multiplier.toFixed(1)}x</span>
        </div>
      </div>

      <div className="dash-status-progress__tracker">
        <div className="dash-status-progress__rail">
          <div className="dash-status-progress__track" aria-hidden="true">
            <span className="dash-status-progress__fill" style={{ width: `${barPct}%` }} />
          </div>

          <span
            className="dash-status-progress__needle"
            style={{ left: `${progressPct}%` }}
            aria-hidden="true"
          />

          <div className="dash-status-progress__nodes">
            {STATUS_MILESTONES.map((milestone) => (
              <StatusMilestoneNode
                key={milestone.id}
                milestone={milestone}
                status={getMilestoneNodeStatus(coins, milestone)}
                positionPct={milestonePositionPct(milestone.coinsRequired, maxCoins)}
              />
            ))}
          </div>
        </div>
      </div>

      {next ? (
        <p className="dash-status-progress__hint">
          {coinsToNext.toLocaleString()} coins until {next.name} ({next.multiplier.toFixed(1)}x multiplier)
        </p>
      ) : (
        <p className="dash-status-progress__hint">You&apos;ve unlocked every status milestone.</p>
      )}
    </div>
  );
}
