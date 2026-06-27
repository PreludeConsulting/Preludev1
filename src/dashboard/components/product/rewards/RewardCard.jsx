import RewardIcon from "./RewardIcon.jsx";
import RewardTierBadge from "./RewardTierBadge.jsx";

export function ProgressBar({ pct, className = "", animate = true, accentColor }) {
  return (
    <div
      className={`dash-rewards-progress${animate ? " dash-rewards-progress--animate" : ""}${className ? ` ${className}` : ""}`}
      style={accentColor ? { "--progress-accent": accentColor } : undefined}
      aria-hidden="true"
    >
      <span className="dash-rewards-progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RewardCard({ reward, variant = "shop", onRedeem, coins }) {
  const isFeatured = variant === "featured";
  const tierId = reward.tier || "common";
  const tierConfig = reward.tierConfig;
  const accent = tierConfig?.accentColor;

  const cardClass = isFeatured
    ? `dash-rewards-featured dash-rewards-featured--compact dash-rewards-featured--tier-${tierId}${reward.redeemed ? " dash-rewards-store-card--redeemed" : ""}${reward.canRedeem ? " dash-rewards-store-card--ready" : ""}`
    : `dash-rewards-store-card dash-rewards-store-card--compact dash-rewards-store-card--tier-${tierId}${reward.redeemed ? " dash-rewards-store-card--redeemed" : ""}${reward.canRedeem ? " dash-rewards-store-card--ready" : ""}`;

  return (
    <article
      className={cardClass}
      style={{
        "--tier-accent": accent,
        "--tier-bg": tierConfig?.backgroundColor
      }}
    >
      {isFeatured ? (
        <div className="dash-rewards-featured__badges">
          <span className="dash-rewards-featured__badge">Featured</span>
          <RewardTierBadge tier={tierId} pulse={reward.canRedeem && !reward.redeemed} />
        </div>
      ) : (
        <div className="dash-rewards-store-card__badge-row">
          <RewardTierBadge tier={tierId} pulse={reward.canRedeem && !reward.redeemed} />
        </div>
      )}

      <div className={isFeatured ? "dash-rewards-featured__layout" : "dash-rewards-store-card__inner"}>
        <div className={isFeatured ? "dash-rewards-featured__body" : "dash-rewards-store-card__content"}>
          <div className="dash-rewards-store-card__head">
            <RewardIcon reward={reward} large={isFeatured} tier={tierId} />
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

          {reward.canRedeem && !reward.redeemed ? (
            <p className="dash-rewards-store-card__ready-hint">Ready to redeem</p>
          ) : null}

          {isFeatured && !reward.redeemed && reward.coinsAway > 0 ? (
            <div className="dash-rewards-store-card__progress">
              <p className="dash-rewards-store-card__away">{reward.coinsAway} coins away</p>
              <ProgressBar pct={reward.progressPct} className="dash-rewards-progress--compact" accentColor={accent} />
            </div>
          ) : null}

          {!isFeatured && !reward.redeemed ? (
            <div className="dash-rewards-store-card__progress-slot">
              {reward.coinsAway > 0 ? (
                <div className="dash-rewards-store-card__progress-inline">
                  <p className="dash-rewards-store-card__away">{reward.coinsAway} coins away</p>
                  <ProgressBar pct={reward.progressPct} className="dash-rewards-progress--inline" accentColor={accent} />
                </div>
              ) : null}
            </div>
          ) : null}

          {reward.redeemed ? (
            <span className="dash-rewards-store-card__status">Redeemed</span>
          ) : (
            <button
              type="button"
              className={`dash-btn dash-btn--sm dash-rewards-redeem-btn dash-rewards-redeem-btn--tier-${tierId}${reward.canRedeem ? " dash-btn--primary dash-rewards-redeem-btn--active" : " dash-rewards-redeem-btn--insufficient"}${isFeatured ? " dash-rewards-featured__cta" : " dash-rewards-store-card__btn"}`}
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
