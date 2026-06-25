import { getRewardTierConfig } from "../../../lib/progressRewards.js";

export default function RewardTierBadge({ tier, className = "", pulse = false }) {
  const config = getRewardTierConfig(tier);
  return (
    <span
      className={`dash-reward-tier-badge ${config.badgeClass}${pulse ? " dash-reward-tier-badge--pulse" : ""}${className ? ` ${className}` : ""}`.trim()}
      style={{
        "--tier-accent": config.accentColor,
        "--tier-bg": config.backgroundColor
      }}
    >
      {config.label}
    </span>
  );
}
