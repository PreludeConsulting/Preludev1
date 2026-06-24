import { useState } from "react";
import { Gift } from "lucide-react";
import { GRID_REWARD_IDS } from "../../../lib/progressRewards.js";
import { useProgressRewards } from "../../../context/ProgressRewardsContext.jsx";
import PreludePiggyBank from "./PreludePiggyBank.jsx";
import RewardIcon from "./RewardIcon.jsx";
import RewardRedeemModal from "./RewardRedeemModal.jsx";

function ProgressBar({ pct, className = "", animate = true }) {
  return (
    <div className={`dash-rewards-progress${animate ? " dash-rewards-progress--animate" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <span className="dash-rewards-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function RewardCard({ reward, variant = "grid", onRedeem }) {
  const isFeatured = variant === "featured";

  return (
    <article
      className={`${isFeatured ? "dash-rewards-featured dash-rewards-featured--compact" : `dash-rewards-store-card dash-rewards-store-card--compact dash-rewards-store-card--${reward.iconTone}`}${reward.redeemed ? " dash-rewards-store-card--redeemed" : ""}${reward.canRedeem ? " dash-rewards-store-card--ready" : ""}`}
    >
      {isFeatured ? <span className="dash-rewards-featured__badge">Featured</span> : null}

      <div className={isFeatured ? "dash-rewards-featured__layout" : "dash-rewards-store-card__inner"}>
        {isFeatured ? (
          <div className="dash-rewards-featured__visual">
            <PreludePiggyBank size="md" withCoins withSparkles />
          </div>
        ) : null}

        <div className={isFeatured ? "dash-rewards-featured__body" : "dash-rewards-store-card__content"}>
          <div className="dash-rewards-store-card__head">
            <RewardIcon reward={reward} large={isFeatured} />
            <div className="dash-rewards-store-card__copy">
              <h3 className={isFeatured ? "dash-rewards-featured__title" : "dash-rewards-store-card__title"}>
                {reward.headline}
              </h3>
              {reward.subtitle ? (
                <p className="dash-rewards-store-card__subtitle">{reward.subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className={isFeatured ? "dash-rewards-featured__meta" : "dash-rewards-store-card__meta"}>
            <span className={isFeatured ? "dash-rewards-featured__cost" : "dash-rewards-store-card__cost"}>
              {reward.coins} Coins
            </span>
            <span className={isFeatured ? "dash-rewards-featured__value" : "dash-rewards-store-card__value"}>
              ${reward.estimatedValue} Value
            </span>
          </div>

          {isFeatured && !reward.redeemed && reward.coinsAway > 0 ? (
            <div className="dash-rewards-store-card__progress">
              <p className="dash-rewards-store-card__away">{reward.coinsAway} coins away</p>
              <ProgressBar pct={reward.progressPct} className="dash-rewards-progress--compact" />
            </div>
          ) : null}

          {!isFeatured && !reward.redeemed ? (
            <div className="dash-rewards-store-card__progress-slot">
              {reward.coinsAway > 0 ? (
                <div className="dash-rewards-store-card__progress-inline">
                  <p className="dash-rewards-store-card__away">{reward.coinsAway} coins away</p>
                  <ProgressBar pct={reward.progressPct} className="dash-rewards-progress--inline" />
                </div>
              ) : null}
            </div>
          ) : null}

          {reward.redeemed ? (
            <span className="dash-rewards-store-card__status">Redeemed</span>
          ) : (
            <button
              type="button"
              className={`dash-btn dash-btn--sm dash-rewards-redeem-btn${reward.canRedeem ? " dash-btn--primary" : " dash-rewards-redeem-btn--insufficient"}${isFeatured ? " dash-rewards-featured__cta" : " dash-rewards-store-card__btn"}`}
              onClick={() => onRedeem(reward)}
            >
              Redeem
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function RedeemTab() {
  const { coins, rewards, featuredReward, handleRedeemReward } = useProgressRewards();
  const [modalReward, setModalReward] = useState(null);

  const gridRewards = GRID_REWARD_IDS
    .map((id) => rewards.find((r) => r.id === id))
    .filter(Boolean);

  function openRedeemModal(reward) {
    setModalReward(reward);
  }

  function closeModal() {
    setModalReward(null);
  }

  function confirmRedeem(reward, options) {
    const result = handleRedeemReward(reward.id, options);
    return result;
  }

  return (
    <div className="dash-rewards-tab-panel">
      <h2 className="dash-rewards-section-label dash-rewards-section-label--featured">Featured Reward</h2>
      <RewardCard reward={featuredReward} variant="featured" onRedeem={openRedeemModal} />

      <h3 className="dash-rewards-section-label" id="all-rewards">All Rewards</h3>
      <div className="dash-rewards-store-grid dash-rewards-store-grid--six">
        {gridRewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} onRedeem={openRedeemModal} />
        ))}
      </div>

      <footer className="dash-rewards-store-footer">
        <a href="#all-rewards" className="dash-rewards-store-footer__link">View all rewards →</a>
        <p className="dash-rewards-store-footer__note">
          <Gift className="dash-rewards-store-footer__gift" aria-hidden="true" />
          New rewards added regularly!
        </p>
      </footer>

      <RewardRedeemModal
        reward={modalReward}
        coins={coins}
        onClose={closeModal}
        onConfirm={confirmRedeem}
      />
    </div>
  );
}

export { ProgressBar };
