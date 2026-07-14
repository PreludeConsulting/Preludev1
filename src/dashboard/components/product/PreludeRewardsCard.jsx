import { Coins, Diamond, Flag, Gift, Sparkle, Sparkles, User } from "lucide-react";
import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useProgressRewards } from "../../context/ProgressRewardsContext.jsx";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";
import { usePlanUpgrade } from "../../context/PlanUpgradeContext.jsx";
import { CoinBalance } from "./rewards/PreludePiggyBank.jsx";
import { GLASS_PIGGY_IMAGE } from "./rewards/PiggyBankProgress.jsx";

function LockedRewardsIllustration() {
  return (
    <div className="dash-prelude-rewards-locked__art" aria-hidden="true">
      <span className="dash-prelude-rewards-locked__glow" />
      <span className="dash-prelude-rewards-locked__sparkle dash-prelude-rewards-locked__sparkle--1">
        <Sparkle />
      </span>
      <span className="dash-prelude-rewards-locked__sparkle dash-prelude-rewards-locked__sparkle--2">
        <Sparkle />
      </span>
      <span className="dash-prelude-rewards-locked__sparkle dash-prelude-rewards-locked__sparkle--3">
        <Sparkle />
      </span>
      <span className="dash-prelude-rewards-locked__sparkle dash-prelude-rewards-locked__sparkle--4">
        <Sparkle />
      </span>
      <span className="dash-prelude-rewards-locked__float dash-prelude-rewards-locked__float--gift">
        <Gift />
      </span>
      <span className="dash-prelude-rewards-locked__float dash-prelude-rewards-locked__float--coin">
        <Coins />
      </span>
      <span className="dash-prelude-rewards-locked__float dash-prelude-rewards-locked__float--user">
        <User />
      </span>
      <span className="dash-prelude-rewards-locked__hero">
        <Diamond />
      </span>
    </div>
  );
}

export default function PreludeRewardsCard() {
  const { canAccess } = usePlanAccess();
  const { openUpgrade } = usePlanUpgrade();
  const {
    coins,
    featuredReward,
    piggyGoalCoins,
    piggyCanRedeem,
    nextRewardTarget
  } = useProgressRewards();

  if (!canAccess("rewards")) {
    return (
      <article className="dash-product-card dash-product-card--wide dash-product-card--rewards dash-prelude-rewards-preview dash-prelude-rewards-preview--locked">
        <div className="dash-prelude-rewards-locked">
          <div className="dash-prelude-rewards-locked__copy">
            <p className="dash-prelude-rewards-locked__eyebrow">Prelude Rewards</p>
            <span className="dash-prelude-rewards-locked__badge" aria-hidden="true">
              <Diamond />
            </span>
            <h2 className="dash-prelude-rewards-locked__title">
              Get more with{" "}
              <span className="dash-prelude-rewards-locked__title-accent">Plus &amp; Pro</span>
            </h2>
            <p className="dash-prelude-rewards-locked__subtext">
              Earn coins, access bonus mentor sessions, and unlock exclusive rewards along the way.
            </p>
            <button
              type="button"
              className="dash-prelude-rewards-locked__cta"
              onClick={() => openUpgrade("rewards")}
            >
              <Sparkles className="dash-prelude-rewards-locked__cta-icon" aria-hidden="true" />
              Explore Plans
            </button>
          </div>
          <LockedRewardsIllustration />
        </div>
      </article>
    );
  }

  const goalCoins = piggyGoalCoins || featuredReward?.coins || 60;
  const progressPct = goalCoins > 0 ? Math.min(100, Math.round((coins / goalCoins) * 100)) : 100;
  const coinsAway = nextRewardTarget?.coinsAway ?? Math.max(0, goalCoins - coins);
  const nextName = nextRewardTarget?.reward?.title || featuredReward?.headline || "next reward";
  const nextCoins = nextRewardTarget?.goalCoins ?? featuredReward?.coins ?? goalCoins;
  const awayCopy = piggyCanRedeem
    ? "You can redeem a reward now"
    : "more coins needed";

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
            <span className="dash-prelude-rewards-preview__away-num">{piggyCanRedeem ? "✓" : coinsAway}</span>
            {piggyCanRedeem ? null : " "}
            {awayCopy}
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
