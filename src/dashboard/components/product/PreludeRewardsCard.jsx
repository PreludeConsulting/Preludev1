import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import PreludePiggyBank, { CoinBalance } from "./rewards/PreludePiggyBank.jsx";

export default function PreludeRewardsCard() {
  const { coins, featuredReward, coinsToNext } = useProgressRewards();
  const progressPct = featuredReward
    ? Math.min(100, Math.round((coins / featuredReward.coins) * 100))
    : 100;

  const awayCopy = coinsToNext > 0
    ? `${coinsToNext} coins away from a ${featuredReward.headline}`
    : `Ready to redeem a ${featuredReward.headline}`;

  return (
    <article className="dash-product-card dash-product-card--wide dash-product-card--rewards dash-prelude-rewards-preview">
      <div className="dash-prelude-rewards-preview__layout">
        <div className="dash-prelude-rewards-preview__visual">
          <PreludePiggyBank size="sm" />
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
