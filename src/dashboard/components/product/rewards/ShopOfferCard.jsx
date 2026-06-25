import { Sparkles, Star } from "lucide-react";
import { CoinIcon } from "./PreludePiggyBank.jsx";
import RewardIcon from "./RewardIcon.jsx";
import RewardTierBadge from "./RewardTierBadge.jsx";
import { ProgressBar } from "./RewardCard.jsx";

const OFFER_LABELS = {
  common: "Daily Offer",
  uncommon: "Uncommon Offer",
  rare: "Rare Offer",
  epic: "Epic Offer",
  legendary: "Legendary Offer"
};

export default function ShopOfferCard({ reward, onRedeem }) {
  const tierId = reward.tier || "common";
  const tierConfig = reward.tierConfig;
  const accent = tierConfig?.accentColor;
  const offerLabel = OFFER_LABELS[tierId] || "Daily Offer";

  const showProgress = !reward.redeemed && !reward.canRedeem && reward.coinsAway > 0;
  const showReady = !reward.redeemed && reward.canRedeem;

  return (
    <article
      className={`dash-shop-offer dash-shop-offer--tier-${tierId}${reward.redeemed ? " dash-shop-offer--redeemed" : ""}${reward.canRedeem ? " dash-shop-offer--ready" : ""}`}
      style={{ "--tier-accent": accent }}
    >
      <div className="dash-shop-offer__hero">
        <div className="dash-shop-offer__header">
          <span className="dash-shop-offer__label">
            <Sparkles className="dash-shop-offer__label-icon" aria-hidden="true" />
            {offerLabel}
          </span>
          <RewardTierBadge
            tier={tierId}
            className="dash-shop-offer__tier-badge"
            pulse={reward.canRedeem && !reward.redeemed}
          />
        </div>

        <div className="dash-shop-offer__visual">
          <div className="dash-shop-offer__visual-bg" aria-hidden="true" />
          <div className="dash-shop-offer__visual-rays" aria-hidden="true" />

          <div className="dash-shop-offer__float-coin dash-shop-offer__float-coin--1" aria-hidden="true">
            <CoinIcon />
          </div>
          <div className="dash-shop-offer__float-coin dash-shop-offer__float-coin--2" aria-hidden="true">
            <CoinIcon />
          </div>
          <div className="dash-shop-offer__float-coin dash-shop-offer__float-coin--3" aria-hidden="true">
            <CoinIcon />
          </div>

          <div className="dash-shop-offer__ticket dash-shop-offer__ticket--1" aria-hidden="true">
            <Star className="dash-shop-offer__ticket-star" />
          </div>
          <div className="dash-shop-offer__ticket dash-shop-offer__ticket--2" aria-hidden="true">
            <Star className="dash-shop-offer__ticket-star" />
          </div>

          <Sparkles className="dash-shop-offer__sparkle dash-shop-offer__sparkle--1" aria-hidden="true" />
          <Sparkles className="dash-shop-offer__sparkle dash-shop-offer__sparkle--2" aria-hidden="true" />
          <Sparkles className="dash-shop-offer__sparkle dash-shop-offer__sparkle--3" aria-hidden="true" />

          <div className="dash-shop-offer__icon-stage">
            <div className="dash-shop-offer__icon-halo" aria-hidden="true" />
            <div className="dash-shop-offer__icon-wrap">
              <RewardIcon reward={reward} large tier={tierId} />
            </div>
          </div>
        </div>
      </div>

      <div className="dash-shop-offer__body">
        <div className="dash-shop-offer__info">
          <h4 className="dash-shop-offer__title">{reward.headline}</h4>
          <p className="dash-shop-offer__subtitle">{reward.subtitle || "\u00A0"}</p>
          <div className="dash-shop-offer__divider" aria-hidden="true" />
        </div>

        <div className="dash-shop-offer__footer">
          <div className="dash-shop-offer__pricing">
            <span className="dash-shop-offer__cost">
              <CoinIcon size="sm" />
              {reward.coins} Coins
            </span>
            <span className="dash-shop-offer__value">${reward.estimatedValue} Value</span>
          </div>

          <div className="dash-shop-offer__progress">
            {showReady ? (
              <p className="dash-shop-offer__ready">Ready to redeem</p>
            ) : showProgress ? (
              <>
                <p className="dash-shop-offer__away">{reward.coinsAway} coins away</p>
                <ProgressBar
                  pct={reward.progressPct}
                  className="dash-rewards-progress--inline dash-shop-offer__progress-bar"
                  accentColor={accent}
                />
              </>
            ) : (
              <span className="dash-shop-offer__progress-spacer" aria-hidden="true" />
            )}
          </div>

          {reward.redeemed ? (
            <span className="dash-shop-offer__status">Redeemed</span>
          ) : (
            <button
              type="button"
              className={`dash-btn dash-rewards-redeem-btn dash-rewards-redeem-btn--tier-${tierId}${reward.canRedeem ? " dash-rewards-redeem-btn--active" : " dash-rewards-redeem-btn--insufficient"} dash-shop-offer__btn`}
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
