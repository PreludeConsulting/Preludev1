import { getRewardTierConfig } from "../../../lib/progressRewards.js";
import PiggyBankProgress from "./PiggyBankProgress.jsx";

export default function CoinCelebration({
  tier = "common",
  title,
  subtitle,
  coins,
  coinsBalance,
  goalCoins,
  variant = "redeem",
  onDone
}) {
  const config = getRewardTierConfig(tier);

  return (
    <div
      className={`dash-rewards-celebration dash-rewards-celebration--tier ${config.animationClass}`}
      role="status"
      aria-live="polite"
    >
      <div className="dash-rewards-celebration__effects" aria-hidden="true">
        <span className="dash-rewards-celebration__spark dash-rewards-celebration__spark--1" />
        <span className="dash-rewards-celebration__spark dash-rewards-celebration__spark--2" />
        <span className="dash-rewards-celebration__spark dash-rewards-celebration__spark--3" />
        <span className="dash-rewards-celebration__glow-ring" />
        {tier === "legendary" || tier === "epic" ? (
          <>
            <span className="dash-rewards-celebration__float-coin dash-rewards-celebration__float-coin--1" />
            <span className="dash-rewards-celebration__float-coin dash-rewards-celebration__float-coin--2" />
            <span className="dash-rewards-celebration__float-coin dash-rewards-celebration__float-coin--3" />
          </>
        ) : null}
      </div>

      <div className="dash-rewards-celebration__card">
        {variant === "redeem" ? (
          <PiggyBankProgress
            coins={coinsBalance ?? 0}
            goalCoins={goalCoins ?? 300}
            size="md"
            piggyAnimate
            withDropAnimation={false}
            className="dash-rewards-celebration__piggy"
          />
        ) : (
          <PiggyBankProgress
            coins={coinsBalance ?? coins ?? 0}
            goalCoins={goalCoins ?? 300}
            size="md"
            piggyAnimate
            withDropAnimation={false}
            className="dash-rewards-celebration__piggy"
          />
        )}

        <p className="dash-rewards-celebration__eyebrow">
          {variant === "redeem" ? "Reward redeemed" : "Milestone complete"}
        </p>
        <p className="dash-rewards-celebration__title">{title}</p>
        {subtitle ? (
          <p className="dash-rewards-celebration__coins-label">{subtitle}</p>
        ) : coins ? (
          <p className="dash-rewards-celebration__coins-label">+{coins} Prelude Coins</p>
        ) : null}
        <p className="dash-rewards-celebration__hint">
          {variant === "redeem"
            ? "A mentor will follow up with next steps."
            : "Coins added to your Piggy Bank"}
        </p>
        {onDone ? (
          <button type="button" className="dash-btn dash-btn--primary dash-btn--sm dash-rewards-celebration__done" onClick={onDone}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}
