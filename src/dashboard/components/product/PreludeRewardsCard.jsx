import { Flag, Gift, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";
import { usePlanUpgrade } from "../../context/PlanUpgradeContext.jsx";
import { CoinBalance } from "./rewards/PreludePiggyBank.jsx";
import { GLASS_PIGGY_IMAGE } from "./rewards/PiggyBankProgress.jsx";

export default function PreludeRewardsCard() {
  const { canAccess } = usePlanAccess();
  const { openUpgrade } = usePlanUpgrade();
  const { coins, featuredReward, coinsToNext, statusGoalCoins, nextTier, coinsToNextMultiplier } = useProgressRewards();

  if (!canAccess("rewards")) {
    return (
      <article className="dash-product-card dash-product-card--wide dash-product-card--rewards dash-prelude-rewards-preview dash-prelude-rewards-preview--locked">
        <header className="dash-product-card__head dash-product-card__head--profile-strength">
          <p className="dash-product-card__eyebrow">Prelude Rewards</p>
        </header>
        <div className="dash-prelude-rewards-preview__locked">
          <span className="dash-prelude-rewards-preview__locked-icon" aria-hidden="true">
            <Lock />
          </span>
          <h2 className="dash-prelude-rewards-preview__title">Unlock more with Plus and Pro</h2>
          <p className="dash-prelude-rewards-preview__subtext">
            Earn coins, unlock bonus mentor sessions, and redeem exclusive rewards.
          </p>
          <button
            type="button"
            className="dash-btn dash-btn--primary dash-prelude-rewards-preview__cta"
            onClick={() => openUpgrade("rewards")}
          >
            <Gift className="dash-prelude-rewards-preview__cta-icon" aria-hidden="true" />
            View Plans
          </button>
        </div>
      </article>
    );
  }

  const goalCoins = statusGoalCoins || featuredReward?.coins || 300;
  const progressPct = goalCoins > 0 ? Math.min(100, Math.round((coins / goalCoins) * 100)) : 100;
  const coinsAway = nextTier ? coinsToNextMultiplier : coinsToNext;
  const nextName = nextTier?.name || featuredReward.headline;
  const nextCoins = nextTier?.coinsRequired ?? featuredReward.coins;

  return (
    <article className="dash-product-card dash-product-card--wide dash-product-card--rewards dash-prelude-rewards-preview">
      <header className="dash-product-card__head dash-product-card__head--profile-strength">
        <p className="dash-product-card__eyebrow">Prelude Rewards</p>
      </header>

      <div className="dash-prelude-rewards-preview__grid">
        <div className="dash-prelude-rewards-preview__visual">
          <img src={GLASS_PIGGY_IMAGE} alt="" className="dash-prelude-rewards-preview__pig" />
          <CoinBalance value={coins} className="dash-prelude-rewards-preview__coins" />
          <span className="dash-prelude-rewards-preview__coins-label">Coins Saved</span>
        </div>

        <div className="dash-prelude-rewards-preview__progress">
          <p className="dash-prelude-rewards-preview__away">
            <span className="dash-prelude-rewards-preview__away-num">{coinsAway}</span>
            {" "}coins until {nextName}
          </p>
          <div className="dash-prelude-rewards-preview__track" aria-hidden="true">
            <span className="dash-prelude-rewards-preview__fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="dash-prelude-rewards-preview__range">
            <span>0</span>
            <span>{goalCoins}</span>
          </div>
          <div className="dash-prelude-rewards-preview__next">
            <span className="dash-prelude-rewards-preview__next-icon-wrap">
              <Flag className="dash-prelude-rewards-preview__next-icon" aria-hidden="true" />
            </span>
            <span className="dash-prelude-rewards-preview__next-text">
              <span className="dash-prelude-rewards-preview__next-label">Next Reward</span>
              <strong className="dash-prelude-rewards-preview__next-name">{nextName}</strong>
              <span className="dash-prelude-rewards-preview__next-coins">{nextCoins} Coins</span>
            </span>
          </div>
        </div>

        <div className="dash-prelude-rewards-preview__copy">
          <h2 className="dash-prelude-rewards-preview__title">Fill your Piggy Bank</h2>
          <p className="dash-prelude-rewards-preview__subtext">Fill your Piggy Bank and unlock free support.</p>
        </div>
      </div>

      <div className="dash-prelude-rewards-preview__divider" aria-hidden="true" />

      <Link
        to={`${STUDENT_DASHBOARD_BASE}/progress-rewards`}
        className="dash-prelude-rewards-preview__cta"
      >
        <Gift className="dash-prelude-rewards-preview__cta-icon" aria-hidden="true" />
        View Rewards
      </Link>
    </article>
  );
}
