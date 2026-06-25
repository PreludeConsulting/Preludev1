import { FileText, Sparkles, Star } from "lucide-react";
import { CoinIcon } from "./PreludePiggyBank.jsx";
import { ProgressBar } from "./RewardCard.jsx";

export default function FeaturedRewardCard({ reward, onRedeem }) {
  const showProgress = !reward.redeemed && reward.coinsAway > 0;
  const showReady = reward.canRedeem && !reward.redeemed;

  return (
    <article className={`dash-feat${reward.redeemed ? " dash-feat--redeemed" : ""}`}>
      <div className="dash-feat__panel">
        <div className="dash-feat__badges">
          <span className="dash-feat__badge dash-feat__badge--offer">
            <Sparkles className="dash-feat__badge-icon" aria-hidden="true" />
            Featured Offer
          </span>
          <span className="dash-feat__badge dash-feat__badge--tier">Legendary</span>
        </div>

        <div className="dash-feat__head">
          <div className="dash-feat__icon">
            <FileText aria-hidden="true" />
          </div>
          <div className="dash-feat__copy">
            <h3 className="dash-feat__title">{reward.headline}</h3>
            {reward.subtitle ? <p className="dash-feat__subtitle">{reward.subtitle}</p> : null}
            {reward.description ? <p className="dash-feat__desc">{reward.description}</p> : null}
          </div>
        </div>

        <div className="dash-feat__divider" aria-hidden="true" />

        <div className="dash-feat__pricing">
          <span className="dash-feat__cost">
            <CoinIcon />
            {reward.coins} Coins
          </span>
          <span className="dash-feat__value">${reward.estimatedValue} Value</span>
        </div>

        {showReady ? (
          <p className="dash-feat__ready">Ready to redeem</p>
        ) : showProgress ? (
          <div className="dash-feat__progress">
            <p className="dash-feat__away">{reward.coinsAway} coins away</p>
            <ProgressBar
              pct={reward.progressPct}
              className="dash-rewards-progress--inline dash-feat__progress-bar"
              accentColor="#f59e0b"
            />
          </div>
        ) : null}

        {reward.redeemed ? (
          <span className="dash-feat__status">Redeemed</span>
        ) : (
          <button
            type="button"
            className={`dash-feat__cta${reward.canRedeem ? " dash-feat__cta--active" : " dash-feat__cta--insufficient"}`}
            onClick={() => onRedeem(reward)}
          >
            Redeem
          </button>
        )}
      </div>

      <div className="dash-feat__hero">
        <div className="dash-feat__hero-rays" aria-hidden="true" />
        <div className="dash-feat__hero-glow" aria-hidden="true" />

        <div className="dash-feat__hero-badges">
          <span className="dash-feat__badge dash-feat__badge--offer dash-feat__badge--onhero">
            <Sparkles className="dash-feat__badge-icon" aria-hidden="true" />
            Featured Offer
          </span>
          <span className="dash-feat__badge dash-feat__badge--tier dash-feat__badge--onhero">Legendary</span>
        </div>

        <div className="dash-feat__coin dash-feat__coin--1" aria-hidden="true"><CoinIcon /></div>
        <div className="dash-feat__coin dash-feat__coin--2" aria-hidden="true"><CoinIcon /></div>
        <div className="dash-feat__coin dash-feat__coin--3" aria-hidden="true"><CoinIcon /></div>

        <div className="dash-feat__ticket dash-feat__ticket--1" aria-hidden="true">
          <Star className="dash-feat__ticket-star" />
        </div>
        <div className="dash-feat__ticket dash-feat__ticket--2" aria-hidden="true">
          <Star className="dash-feat__ticket-star" />
        </div>

        <Sparkles className="dash-feat__spark dash-feat__spark--1" aria-hidden="true" />
        <Sparkles className="dash-feat__spark dash-feat__spark--2" aria-hidden="true" />
        <Sparkles className="dash-feat__spark dash-feat__spark--3" aria-hidden="true" />
        <Sparkles className="dash-feat__spark dash-feat__spark--4" aria-hidden="true" />

        <div className="dash-feat__hero-icon" aria-hidden="true">
          <FileText />
        </div>
      </div>
    </article>
  );
}
