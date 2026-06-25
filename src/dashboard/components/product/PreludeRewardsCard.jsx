import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import { CoinBalance } from "./rewards/PreludePiggyBank.jsx";
import PiggyBankProgress from "./rewards/PiggyBankProgress.jsx";

export default function PreludeRewardsCard() {
  const { coins, featuredReward, coinsToNext, statusGoalCoins, nextTier, coinsToNextMultiplier } = useProgressRewards();
  const goalCoins = statusGoalCoins || featuredReward?.coins || 300;
  const progressPct = goalCoins > 0 ? Math.min(100, Math.round((coins / goalCoins) * 100)) : 100;

  const awayCopy = nextTier
    ? `${coinsToNextMultiplier} coins until ${nextTier.name}`
    : coinsToNext > 0
      ? `${coinsToNext} coins away from a ${featuredReward.headline}`
      : `Ready to redeem a ${featuredReward.headline}`;

  return (
    <article className="dash-product-card dash-product-card--wide dash-product-card--rewards dash-prelude-rewards-preview">
      <div className="dash-prelude-rewards-preview__layout">
        <div className="dash-prelude-rewards-preview__visual">
          <PiggyBankProgress coins={coins} goalCoins={goalCoins} size="sm" withDropAnimation={false} />
        </div>
        <div className="dash-prelude-rewards-preview__copy">
          <p className="dash-product-card__eyebrow">Prelude Rewards</p>
          <h3 className="dash-product-card__title">Fill your Piggy Bank</h3>
          <p className="dash-prelude-rewards-preview__subtext">Fill your Piggy Bank and unlock free support.</p>
        </div>
      </div>

      <div className="dash-prelude-rewards-preview__balance">
        <CoinBalance value={coins} className="dash-prelude-rewards-preview__coins" />
        <span className="dash-prelude-rewards-preview__coins-label">Coins Saved</span>
      </div>

      <div className="dash-prelude-rewards-preview__progress-wrap">
        <p className="dash-prelude-rewards-preview__away">{awayCopy}</p>
        <div className="dash-prelude-rewards-preview__track" aria-hidden="true">
          <span className="dash-prelude-rewards-preview__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="dash-prelude-rewards-preview__next">Next: {featuredReward.headline}</p>
      </div>

      <Link to={`${STUDENT_DASHBOARD_BASE}/progress-rewards`} className="dash-btn dash-btn--primary dash-btn--sm dash-prelude-rewards-preview__cta">
        View Rewards
      </Link>
    </article>
  );
}
