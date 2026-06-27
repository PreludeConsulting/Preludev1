import { Crown, FileText, Mountain, Sprout, Target, Zap } from "lucide-react";

const ICONS = {
  seedling: Sprout,
  target: Target,
  zap: Zap,
  file: FileText,
  mountain: Mountain,
  crown: Crown
};

export default function StatusMilestoneNode({ milestone, status, positionPct }) {
  const Icon = ICONS[milestone.icon] || Target;

  return (
    <div
      className={`dash-status-node dash-status-node--${status}`}
      style={{ left: `${positionPct}%` }}
    >
      <div className="dash-status-node__marker" aria-hidden="true">
        <span className="dash-status-node__ring" />
        <span className="dash-status-node__core">
          <Icon className="dash-status-node__icon" />
        </span>
      </div>
      <div className="dash-status-node__label">
        <span className="dash-status-node__name">{milestone.name}</span>
        <span className="dash-status-node__coins">{milestone.coinsRequired.toLocaleString()}</span>
        <span className="dash-status-node__multiplier">{milestone.multiplier.toFixed(1)}x</span>
      </div>
    </div>
  );
}
